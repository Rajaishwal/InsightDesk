// utils/fileUpload.js
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

const fileUpload = async (localFilePath) => {
  try {
    console.log("Starting file upload to Cloudinary:", localFilePath);
    
    if (!localFilePath) {
      console.log("No local file path provided");
      return null;
    }

    // Check if file exists
    if (!fs.existsSync(localFilePath)) {
      console.log("File does not exist:", localFilePath);
      return null;
    }

    console.log("Uploading to Cloudinary...");
    const result = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });

    console.log("Cloudinary upload successful:", result.secure_url);

    // Remove local file after upload
    fs.unlinkSync(localFilePath);
    console.log("Local file removed:", localFilePath);

    return result;
  } catch (error) {
    console.error("File upload error:", error);
    
    // Remove file even if upload fails (if it exists)
    try {
      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
        console.log("Local file removed after error:", localFilePath);
      }
    } catch (unlinkError) {
      console.error("Error removing local file:", unlinkError);
    }
    
    return null;
  }
};

export default fileUpload;
