import React, { useState } from "react";
import { Image, Sparkles } from "lucide-react";
import axios from "axios";
import { useAuth } from "@clerk/clerk-react";
import toast from "react-hot-toast";

axios.defaults.baseURL = import.meta.env.VITE_BASE_URL;

const GenerateImages = () => {
  const imageStyle = [
    "Realistic",
    "Ghibli style",
    "Anime style",
    "Cartoon style",
    "Fantasy style",
    "3D style",
    "Portrait style",
  ];

  const [selectedStyle, setSelectedStyle] = useState("Realistic");
  const [input, setInput] = useState("");
  const [publish, setPublish] = useState(false);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState("");
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const onSubmitHandler = async (e) => {
    e.preventDefault();

    if (!isLoaded) {
      toast.error("Authentication is loading...");
      return;
    }

    if (!isSignedIn) {
      toast.error("Please sign in to generate images");
      return;
    }

    try {
      setLoading(true);

      const prompt = `Generate an image of ${input} in the Style ${selectedStyle}`;
      const token = await getToken();

      if (!token) {
        toast.error("Authentication token not available");
        return;
      }

      const response = await axios.post(
        "/api/ai/generate-image",
        { prompt, publish },
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 120000, // 2 minutes timeout
        }
      );

      const { data } = response;

      if (data.success) {
        if (data.content) {
          setContent(data.content);
          toast.success("Image generated successfully!");
        } else {
          toast.error("Image generated but no content received");
        }
      } else {
        toast.error(data.message || "Failed to generate image");
      }
    } catch (error) {
      if (error.response) {
        const errorMessage = error.response.data?.message || `Server error: ${error.response.status}`;
        toast.error(errorMessage);
      } else if (error.request) {
        toast.error("No response from server. Please check your connection.");
      } else if (error.code === "ECONNABORTED") {
        toast.error("Request timeout. Please try again.");
      } else {
        toast.error(error.message || "An unexpected error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full overflow-y-scroll p-6 flex items-start flex-wrap gap-4 text-slate-700">
      {/* Left Column - Form */}
      <form
        onSubmit={onSubmitHandler}
        className="w-full max-w-lg p-4 bg-white rounded-lg border border-gray-200"
      >
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 text-[#00AD25]" />
          <h1 className="text-xl font-semibold">AI Image Generator</h1>
        </div>

        <p className="mt-6 text-sm font-medium">Describe your Image</p>
        <textarea
          onChange={(e) => setInput(e.target.value)}
          value={input}
          rows={4}
          className="w-full p-2 px-3 mt-2 outline-none text-sm rounded-md border border-gray-300"
          placeholder="Describe what you want to see in the image"
          required
        />

        <p className="mt-4 text-sm font-medium">Style</p>
        <div className="mt-3 flex gap-3 flex-wrap">
          {imageStyle.map((item) => (
            <span
              onClick={() => setSelectedStyle(item)}
              className={`text-xs px-4 py-1 border rounded-full cursor-pointer transition-colors ${
                selectedStyle === item
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "text-gray-500 border-gray-300 hover:border-gray-400"
              }`}
              key={item}
            >
              {item}
            </span>
          ))}
        </div>

        <div className="my-6 flex items-center gap-2">
          <label className="relative cursor-pointer">
            <input
              type="checkbox"
              onChange={(e) => setPublish(e.target.checked)}
              checked={publish}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
          </label>
          <p className="text-sm">Make this image public</p>
        </div>

        <button
          disabled={loading || !isLoaded || !isSignedIn}
          className="w-full flex justify-center items-center gap-2 bg-gradient-to-r from-[#00AD25] to-[#04FF50] text-white px-4 py-2 mt-6 text-sm rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
              <span>Generating...</span>
            </>
          ) : (
            <>
              <Image className="w-5" />
              <span>Generate Image</span>
            </>
          )}
        </button>
      </form>

      {/* Right Column - Result */}
      <div className="w-full max-w-lg p-4 bg-white rounded-lg flex flex-col border border-gray-200 min-h-96">
        <div className="flex items-center gap-3">
          <Image className="w-5 h-5 text-[#00AD25]" />
          <h1 className="text-xl font-semibold">Generated Image</h1>
        </div>

        {loading ? (
          <div className="flex-1 flex justify-center items-center">
            <div className="text-sm flex flex-col items-center gap-5 text-gray-400">
              <div className="w-8 h-8 rounded-full border-2 border-t-transparent border-green-500 animate-spin"></div>
              <p>Generating your image...</p>
            </div>
          </div>
        ) : !content ? (
          <div className="flex-1 flex justify-center items-center">
            <div className="text-sm flex flex-col items-center gap-5 text-gray-400">
              <Image className="w-9 h-9" />
              <p>Enter a topic and click "Generate Image" to get started</p>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex-1">
            <img
              src={content}
              alt="Generated image"
              className="w-full h-full object-contain rounded-lg"
              onError={(e) => {
                console.error("Image load error:", e);
                toast.error("Failed to load generated image");
                setContent(""); // Reset content on error
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default GenerateImages;