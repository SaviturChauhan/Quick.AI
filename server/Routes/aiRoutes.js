import express from "express";
import {
  generateArticle,
  generateBlogTitle,
  generateImage,
  removeImagebackground,
  removeImageObject,
  resumeReview,
} from "../Controllers/aicontroller.js";
import { auth } from "../middlewares/auth.js";
import { upload } from "../configs/multer.js";

const aiRouter = express.Router();

aiRouter.post("/generate-article", auth, generateArticle);
aiRouter.post("/generate-blog-title", auth, generateBlogTitle);
aiRouter.post("/generate-image", auth, generateImage);
aiRouter.post("/remove-image-background", auth, upload.single('image'), removeImagebackground);
aiRouter.post("/remove-image-object", upload.single('image'), auth, removeImageObject);
aiRouter.post("/resume-review", upload.single('resume'), auth, resumeReview);

export default aiRouter;
