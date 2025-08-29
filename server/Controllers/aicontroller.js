import sql from "../configs/db.js";
import { clerkClient } from "@clerk/express";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import pdf from "pdf-parse/lib/pdf-parse.js";
import axios from "axios";
import FormData from "form-data";

// Validate API keys
const validateAPIKeys = () => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  if (!process.env.CLIPDROP_API_KEY) {
    throw new Error("CLIPDROP_API_KEY is not configured");
  }
  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    throw new Error("Cloudinary configuration is incomplete");
  }
};

// Gemini API helper function
const callGeminiAPI = async (prompt, maxTokens = 800) => {
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: 0.7,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (
      response.data.candidates &&
      response.data.candidates[0] &&
      response.data.candidates[0].content
    ) {
      return response.data.candidates[0].content.parts[0].text;
    } else {
      throw new Error("Invalid response from Gemini API");
    }
  } catch (error) {
    console.error("Gemini API error:", error.response?.data || error.message);
    throw new Error("Failed to generate content with Gemini API");
  }
};

export const generateArticle = async (req, res) => {
  try {
    validateAPIKeys();
    const { userId } = req.auth();
    const { prompt, length } = req.body;
    const plan = req.plan;
    const free_usage = req.free_usage;

    if (plan !== "premium" && free_usage >= 10) {
      return res.json({
        success: false,
        message: "Limit reached. Upgrade to continue.",
      });
    }

    const content = await callGeminiAPI(prompt, length);

    await sql`INSERT INTO creations (user_id,prompt,content,type) VALUES (${userId},${prompt},${content},'article')`;

    if (plan !== "premium") {
      await clerkClient.users.updateUserMetadata(userId, {
        privateMetadata: {
          free_usage: free_usage + 1,
        },
      });
    }

    res.json({ success: true, content });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

export const generateBlogTitle = async (req, res) => {
  try {
    validateAPIKeys();
    const { userId } = req.auth();
    const { prompt } = req.body;
    const plan = req.plan;
    const free_usage = req.free_usage;

    if (plan !== "premium" && free_usage >= 10) {
      return res.json({
        success: false,
        message: "Limit reached. Upgrade to continue.",
      });
    }

    const content = await callGeminiAPI(prompt, 100);

    await sql`INSERT INTO creations (user_id,prompt,content,type) VALUES (${userId},${prompt},${content},'blog-title')`;

    if (plan !== "premium") {
      await clerkClient.users.updateUserMetadata(userId, {
        privateMetadata: {
          free_usage: free_usage + 1,
        },
      });
    }

    res.json({ success: true, content });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

// export const generateImage = async (req, res) => {
//   try {
//     validateAPIKeys();
//     const { userId } = req.auth();
//     const { prompt, publish } = req.body;
//     const plan = req.plan;

//     if (plan !== "premium") {
//       return res.json({
//         success: false,
//         message: "This feature is only available for premium subscriptions",
//       });
//     }

//     const formData = new FormData();
//     formData.append("prompt", prompt);

//     const { data } = await axios.post(
//       "https://clipdrop-api.co/text-to-image/v1",
//       formData,
//       {
//         headers: { "x-api-key": process.env.CLIPDROP_API_KEY },
//         responseType: "arraybuffer",
//       }
//     );

//     // const base64image = `data :image/png;base64,${Buffer.from(
//     //   data,
//     //   "binary"
//     // ).toString("base64")}`;

//     const base64image = `data:image/png;base64,${Buffer.from(data, "binary").toString("base64")}`;

//     const { secure_url } = await cloudinary.uploader.upload(base64image);
//     await sql`INSERT INTO creations (user_id,prompt,content,type,publish) VALUES (${userId},${prompt},${secure_url},'image',${
//       publish ?? false
//     })`;

//     res.json({ success: true, content: secure_url });
//   } catch (error) {
//     console.log(error.message);
//     res.json({ success: false, message: error.message });
//   }
// };

// export const removeImagebackground = async (req, res) => {
//   try {
//     validateAPIKeys();
//     const { userId } = req.auth();
//     const image = req.file;
//     const plan = req.plan;

//     if (plan !== "premium") {
//       return res.json({
//         success: false,
//         message: "This feature is only available for premium subscriptions",
//       });
//     }
//     const { secure_url } = await cloudinary.uploader.upload(image.path, {
//       transformation: [
//         {
//           effect: "background-removal",
//           background_removal: "remove-the-background",
//         },
//       ],
//     });
//     await sql`INSERT INTO creations (user_id,prompt,content,type) VALUES (${userId},'Remove background from image',${secure_url},'image')`;

//     res.json({ success: true, content: secure_url });
//   } catch (error) {
//     console.log(error.message);
//     res.json({ success: false, message: error.message });
//   }
// };

export const generateImage = async (req, res) => {
  try {
    validateAPIKeys();
    const { userId } = req.auth();
    const { prompt, publish } = req.body;
    const plan = req.plan;

    if (plan !== "premium") {
      return res.json({
        success: false,
        message: "This feature is only available for premium subscriptions",
      });
    }

    // Validate prompt
    if (!prompt || prompt.trim().length === 0) {
      return res.json({
        success: false,
        message: "Prompt is required",
      });
    }

    const formData = new FormData();
    formData.append("prompt", prompt);

    console.log("Making request to ClipDrop API...");

    const { data } = await axios.post(
      "https://clipdrop-api.co/text-to-image/v1",
      formData,
      {
        headers: {
          "x-api-key": process.env.CLIPDROP_API_KEY,
          ...formData.getHeaders(), // Important for multipart/form-data
        },
        responseType: "arraybuffer",
        timeout: 60000, // 60 second timeout
      }
    );

    console.log("ClipDrop API response received, data length:", data.length);

    // Fixed: Remove the space after "data"
    const base64image = `data:image/png;base64,${Buffer.from(
      data,
      "binary"
    ).toString("base64")}`;

    console.log("Uploading to Cloudinary...");

    const { secure_url } = await cloudinary.uploader.upload(base64image, {
      folder: "ai-generated", // Optional: organize uploads
      resource_type: "image",
    });

    console.log("Cloudinary upload successful:", secure_url);

    await sql`INSERT INTO creations (user_id,prompt,content,type,publish) VALUES (${userId},${prompt},${secure_url},'image',${
      publish ?? false
    })`;

    console.log("Database insert successful");

    res.json({ success: true, content: secure_url });
  } catch (error) {
    console.error("Error in generateImage:", error);

    // More detailed error handling
    if (error.response?.status === 401) {
      return res.json({ success: false, message: "Invalid ClipDrop API key" });
    } else if (error.response?.status === 402) {
      return res.json({
        success: false,
        message: "ClipDrop API quota exceeded",
      });
    } else if (error.response?.status === 429) {
      return res.json({
        success: false,
        message: "Too many requests. Please try again later.",
      });
    } else if (
      error.code === "ECONNABORTED" ||
      error.message.includes("timeout")
    ) {
      return res.json({
        success: false,
        message: "Request timeout. Please try again.",
      });
    } else if (error.message.includes("Cloudinary")) {
      return res.json({
        success: false,
        message: "Image upload failed. Please try again.",
      });
    }

    res.json({
      success: false,
      message: "Failed to generate image. Please try again.",
    });
  }
};
export const removeImagebackground = async (req, res) => {
  try {
    validateAPIKeys();
    const { userId } = req.auth();
    const image = req.file;
    const plan = req.plan;

    if (plan !== "premium") {
      return res.json({
        success: false,
        message: "This feature is only available for premium subscriptions",
      });
    }

    // Option 1: Using Cloudinary's background removal (recommended)
    const { secure_url } = await cloudinary.uploader.upload(image.path, {
      transformation: [
        {
          effect: "background_removal",
          // Changed from "background-removal"
        },
      ],
    });

    // Option 2: Alternative syntax that also works
    // const { secure_url } = await cloudinary.uploader.upload(image.path, {
    //   background_removal: "cloudinary_ai"
    // });

    await sql`INSERT INTO creations (user_id,prompt,content,type) VALUES (${userId},'Remove background from image',${secure_url},'image')`;

    res.json({ success: true, content: secure_url });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};
export const removeImageObject = async (req, res) => {
  try {
    validateAPIKeys();
    const { userId } = req.auth();
    const { object } = req.body;
    const image = req.file;
    const plan = req.plan;

    if (plan !== "premium") {
      return res.json({
        success: false,
        message: "This feature is only available for premium subscriptions",
      });
    }
    const { public_id } = await cloudinary.uploader.upload(image.path);
    const imageUrl = cloudinary.url(public_id, {
      transformation: [{ effect: `gen_remove:${object}` }],
      resource_type: "image",
    });
    await sql`INSERT INTO creations (user_id,prompt,content,type) VALUES (${userId},${`Removed ${object} from image`},${imageUrl},'image')`;

    res.json({ success: true, content: imageUrl });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

export const resumeReview = async (req, res) => {
  try {
    validateAPIKeys();
    const { userId } = req.auth();
    const resume = req.file;
    const plan = req.plan;

    if (plan !== "premium") {
      return res.json({
        success: false,
        message: "This feature is only available for premium subscriptions",
      });
    }

    if (resume.size > 5 * 1024 * 1024) {
      return res.json({
        success: false,
        message: "Resume size exceeds allowed size (5MB).",
      });
    }

    const dataBuffer = fs.readFileSync(resume.path);
    const pdfData = await pdf(dataBuffer);

    const prompt = `Review the following resume and provide constructive feedback on its strengths, weaknesses,and areas of improvement. Resume Content:\n\n${pdfData.text}`;

    const content = await callGeminiAPI(prompt, 1000);

    await sql`INSERT INTO creations (user_id,prompt,content,type) VALUES (${userId},'Review the uploaded Resume ',${content},'resume-review')`;

    res.json({ success: true, content });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};
