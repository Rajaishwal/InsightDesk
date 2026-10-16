// controllers/uploadController.js
import fileUpload from "../utils/fileUpload.js";

export const uploadFile = async (req, res) => {
  try {
    
    const localFilePath = req.file?.path;

    if (!localFilePath) {
      return res.status(400).json({ message: "No file provided" });
    }

    const uploadedFile = await fileUpload(localFilePath);

    if (!uploadedFile) {
      return res.status(500).json({ message: "File upload failed" });
    }

    res.status(200).json({
      message: "File uploaded successfully",
      fileUrl: uploadedFile.secure_url,
      url: uploadedFile.secure_url, // Keep both for compatibility
    });
  } catch (error) {
    console.error("Upload Error:", error);
    res.status(500).json({ 
      message: "Server error during file upload",
      error: error.message 
    });
  }
};
