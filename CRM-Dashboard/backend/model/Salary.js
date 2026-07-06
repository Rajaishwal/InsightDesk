import mongoose from "mongoose";

const salarySchema = new mongoose.Schema(
  {
    // user: { 
    //   type: mongoose.Schema.Types.ObjectId, 
    //   ref: "User", // 🔗 Reference to User collection
    //   required: true 
    // },
    userId: { 
      type: String, 
      required: true 
    },
    // userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    userName: {
      type: String,
      required: true,
    },
    userEmail: {
      type: String,
      required: true,
    },
    basicPay: {
      type: Number,
      required: true,
      min: 0,
    },
    allowances: {
      housing: { type: Number, default: 0, min: 0 },
      medical: { type: Number, default: 0, min: 0 },
      performanceBonus: { type: Number, default: 0, min: 0 },
    },
    deductions: {
      providentFund: { type: Number, default: 0, min: 0 },
      incomeTax: { type: Number, default: 0, min: 0 },
      healthInsurance: { type: Number, default: 0, min: 0 },
    },
    netPay: {
      type: Number,
      min: 0,
      // ❌ remove required:true → it will be auto-calculated
    },
    
    month: { 
      type: String, 
      required: true,
      enum: [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ]
    },
    year: { type: Number, required: true },
    status: {
      type: String,
      enum: ["Pending", "Paid", "Failed"],
      default: "Pending",
    },
    paymentDate: Date,
    processedBy: {
      type: String, // ✅ Changed from ObjectId → String (to accept EMP codes)
    },
    processedAt: Date,
    
    remarks: {
      type: String,
      maxlength: 300,
    },
    downloadUrl: { type: String },
    payslip: {
      filename: String,
      path: String,
      uploadedAt: {
        type: Date,
        default: Date.now,
      },
    },
  },
  { timestamps: true }
);

// Auto-calculate netPay before save
salarySchema.pre("save", function (next) {
  if (this.basicPay !== undefined) {
    // Calculate total allowances
    const allowances = this.allowances || {};
    const totalAllowances =
      (allowances.housing || 0) +
      (allowances.medical || 0) +
      (allowances.performanceBonus || 0);
    // Calculate total deductions
    const deductions = this.deductions || {};
    const totalDeductions =
      (deductions.providentFund || 0) +
      (deductions.incomeTax || 0) +
      (deductions.healthInsurance || 0);
    this.netPay = Math.max(0, this.basicPay + totalAllowances - totalDeductions);
  }
  next();
});

// Indexes for faster queries
salarySchema.index({ userId: 1, month: 1, year: 1 }, { unique: true });
salarySchema.index({ status: 1 });
salarySchema.index({ createdAt: -1 });
salarySchema.index({ "allowances.housing": 1 });
salarySchema.index({ "allowances.transport": 1 });
salarySchema.index({ "allowances.medical": 1 });

export default mongoose.model("Salary", salarySchema);
