import Project from "../model/Project.js";
import User from "../model/User.js";

// Utility: Generate Project ID
const generateProjectId = async () => {
  const lastProject = await Project.findOne().sort({ createdAt: -1 });
  const lastId = lastProject ? lastProject.projectId : "PRJ000";
  const num = parseInt(lastId.replace("PRJ", ""), 10) + 1;
  return `PRJ${num.toString().padStart(3, "0")}`;
};

// Create a new project
export const createProject = async (req, res) => {
  try {
    console.log("📝 Creating new project:", req.body);

    const {
      title,
      description,
      manager,
      email,
      skills,  // fix: consistent naming
      tools,   // fix: consistent naming
      status,
      teamMembers
    } = req.body;

    if (!title || !manager || !email) {
      return res.status(400).json({
        success: false,
        message: "Title, Manager name, and Manager email are required."
      });
    }

    // ✅ Generate new projectId here
    const projectId = await generateProjectId();

    if (teamMembers && teamMembers.length > 4) {
      return res.status(400).json({
        success: false,
        message: "Maximum 4 team members are allowed."
      });
    }

    if (teamMembers && teamMembers.length > 0) {
      for (const member of teamMembers) {
        if (!member.empId || !member.empEmail) {
          return res.status(400).json({
            success: false,
            message: "All team members must have both Employee ID and Email."
          });
        }

        const userExists = await User.findOne({ employeeId: member.empId });
        if (!userExists) {
          return res.status(400).json({
            success: false,
            message: `Employee with ID ${member.empId} not found in the system.`
          });
        }
      }
    }

    const projectData = {
      projectId,
      title,
      description,
      manager,
      email: email.toLowerCase(),
      skills: skills || "",
      tools: tools || "",
      status: status || "Pending",
      teamMembers: teamMembers || [],
      createdBy: req.user._id,
      lastUpdatedBy: req.user._id
    };

    const newProject = new Project(projectData);
    const savedProject = await newProject.save();

    console.log("✅ Project created successfully:", savedProject.projectId);

    res.status(201).json({
      success: true,
      message: "Project created successfully!",
      project: {
        id: savedProject._id,
        projectId: savedProject.projectId,
        title: savedProject.title,
        manager: savedProject.manager,
        status: savedProject.status,
        teamSize: savedProject.teamSize,
        createdAt: savedProject.createdAt
      }
    });

  } catch (error) {
    console.error("❌ Error creating project:", error);

    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation Error",
        errors: validationErrors
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "A project with this Project ID already exists."
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error while creating project.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

// Get all projects
export const getAllProjects = async (req, res) => {
  try {
    console.log('📋 Fetching all projects');
    const { status, manager, page = 1, limit = 10 } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (manager) filter.manager = new RegExp(manager, 'i');

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const projects = await Project.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const totalProjects = await Project.countDocuments(filter);
    const totalPages = Math.ceil(totalProjects / parseInt(limit));

    console.log(`📊 Found ${projects.length} projects (Page ${page}/${totalPages})`);

    res.status(200).json({
      success: true,
      projects,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalProjects,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('❌ Error fetching projects:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching projects.',
      error: error.message,
      stack: error.stack
    });
  }
};

// Get project by ID
export const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔍 Fetching project by ID:', id);

    const project = await Project.findById(id)
      .populate('createdBy', 'name email employeeId')
      .populate('lastUpdatedBy', 'name email employeeId')
      .lean();

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found.'
      });
    }

    console.log('✅ Project found:', project.projectId);

    res.status(200).json({
      success: true,
      project
    });
  } catch (error) {
    console.error('❌ Error fetching project by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching project.'
    });
  }
};

// Update project
export const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('✏️ Update request received:', { id, body: req.body });

    // Try updating by projectId first
    let project = await Project.findOneAndUpdate(
      { projectId: id },
      { ...req.body, lastUpdatedBy: req.user._id },
      { new: true }
    );

    // If not found, try updating by _id
    if (!project) {
      project = await Project.findByIdAndUpdate(
        id,
        { ...req.body, lastUpdatedBy: req.user._id },
        { new: true }
      );
    }

    if (!project) {
      console.error('❌ Project not found for update:', id);
      return res.status(404).json({
        success: false,
        message: 'Project not found.'
      });
    }

    console.log('✅ Project updated successfully:', project.projectId || project._id);

    res.status(200).json({
      success: true,
      message: 'Project updated successfully!',
      project
    });
  } catch (error) {
    console.error('❌ Error updating project:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while updating project.',
      error: error.message
    });
  }
};

// Delete project (soft delete)
export const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🗑️ Deleting project:', id);

    const deletedProject = await Project.findByIdAndUpdate(
      id,
      { isActive: false, lastUpdatedBy: req.user._id },
      { new: true }
    );

    if (!deletedProject) {
      return res.status(404).json({
        success: false,
        message: 'Project not found.'
      });
    }

    console.log('✅ Project deleted successfully:', deletedProject.projectId);

    res.status(200).json({
      success: true,
      message: 'Project deleted successfully!'
    });
  } catch (error) {
    console.error('❌ Error deleting project:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while deleting project.'
    });
  }
};

// Get project statistics
export const getProjectStats = async (req, res) => {
  try {
    console.log('📊 Fetching project statistics');

    const stats = await Project.getProjectStats();
    const totalProjects = await Project.countDocuments({ isActive: true });

    const priorityStats = await Project.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);

    console.log('✅ Project statistics calculated');

    res.status(200).json({
      success: true,
      stats: {
        total: totalProjects,
        byStatus: stats,
        byPriority: priorityStats
      }
    });
  } catch (error) {
    console.error('❌ Error fetching project statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching project statistics.'
    });
  }
};


// Get projects by current user
export const getMyProjects = async (req, res) => {
  try {
    const userEmail = req.user.email?.toLowerCase();
    const userEmpId = req.user.employeeId;

    console.log('👤 Fetching projects for user:', userEmail, userEmpId);

    const projects = await Project.find({
      $and: [
        {
          $or: [
            { statusFlag: true },               // ✅ Active projects
            { statusFlag: { $exists: false } }  // ✅ Handle old projects
          ]
        },
        {
          $or: [
            { email: userEmail },
            { 'teamMembers.empEmail': userEmail },
            { 'teamMembers.empId': userEmpId }
          ]
        }
      ]
    })
      .sort({ createdAt: -1 })
      .lean();

    console.log(`✅ Found ${projects.length} projects for user`);

    res.status(200).json({
      success: true,
      projects
    });
  } catch (error) {
    console.error('❌ Error fetching user projects:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching user projects.'
    });
  }
};
