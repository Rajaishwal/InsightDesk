// controllers/uploadController.js
import fileUpload from "../utils/fileUpload.js";

export const uploadFile = async (req, res) => {
  try {
    console.log("Upload request received");
    console.log("File:", req.file);
    
    const localFilePath = req.file?.path;

    if (!localFilePath) {
      console.log("No file path provided");
      return res.status(400).json({ message: "No file provided" });
    }

    console.log("Uploading file:", localFilePath);
    const uploadedFile = await fileUpload(localFilePath);

    if (!uploadedFile) {
      console.log("File upload failed");
      return res.status(500).json({ message: "File upload failed" });
    }

    console.log("File uploaded successfully:", uploadedFile.secure_url);
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
