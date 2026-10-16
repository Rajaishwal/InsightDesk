// utils/fileUpload.js
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

const fileUpload = async (localFilePath) => {
  try {
    
    if (!localFilePath) {
      return null;
    }

    if (!fs.existsSync(localFilePath)) {
      return null;
    }

    const result = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });

    // Remove local file after upload
    fs.unlinkSync(localFilePath);

    return result;
  } catch (error) {
    console.error("File upload error:", error);
    
    // Remove file even if upload fails (if it exists)
    try {
      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
      }
    } catch (unlinkError) {
      console.error("Error removing local file:", unlinkError);
    }
    
    return null;
  }
};

export default fileUpload;
