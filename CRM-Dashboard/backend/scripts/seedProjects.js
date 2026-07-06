import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

await mongoose.connect(process.env.MONGO_URI);
console.log("✅ MongoDB connected");

const db = mongoose.connection.db;
const projectCol = db.collection("projects");
const userCol    = db.collection("users");

// Core 10 employees for completed projects (EMP051–EMP060)
const coreIds = Array.from({ length: 10 }, (_, i) =>
  `EMP${String(i + 51).padStart(3, "0")}`
);

// On-leave employees (EMP091–EMP099) — assign to ongoing/pending projects
const leaveIds = Array.from({ length: 9 }, (_, i) =>
  `EMP${String(i + 91).padStart(3, "0")}`
);

const [coreEmps, leaveEmps] = await Promise.all([
  userCol.find({ role: "employee", employeeId: { $in: coreIds } }).sort({ employeeId: 1 }).toArray(),
  userCol.find({ role: "employee", employeeId: { $in: leaveIds } }).sort({ employeeId: 1 }).toArray(),
]);

const employees = coreEmps; // alias for completed projects

if (coreEmps.length < 10 || leaveEmps.length < 9) {
  console.error(`❌ Found ${coreEmps.length} core, ${leaveEmps.length} leave employees — run seedEmployees.js first`);
  process.exit(1);
}

console.log(`Found ${coreEmps.length} core + ${leaveEmps.length} on-leave employees for project assignment`);

// Clear existing seeded projects (PRJ001–PRJ015)
const existingIds = Array.from({ length: 15 }, (_, i) =>
  `PRJ${String(i + 1).padStart(3, "0")}`
);
const deleted = await projectCol.deleteMany({ projectId: { $in: existingIds } });
console.log(`🗑️  Cleared ${deleted.deletedCount} existing seed projects`);

const manager = employees[0]; // EMP051 as the team manager

function member(emp) {
  return { _id: new mongoose.Types.ObjectId(), empId: emp.employeeId, empEmail: emp.email };
}

// ── 8 Completed projects (PRJ001–PRJ008) ──
const completedProjects = [
  {
    projectId: "PRJ001",
    title: "Customer Portal Redesign",
    skills: ["React", "Node.js", "MongoDB"],
    tools: ["Figma", "Jira", "Git"],
    teamMembers: [employees[0], employees[1], employees[2]],
    description: "Complete redesign of the customer-facing portal with a modern UI.",
  },
  {
    projectId: "PRJ002",
    title: "Payroll Automation System",
    skills: ["Python", "Django", "PostgreSQL"],
    tools: ["Slack", "Confluence"],
    teamMembers: [employees[2], employees[3], employees[4]],
    description: "Automated end-to-end payroll processing and tax computation.",
  },
  {
    projectId: "PRJ003",
    title: "Mobile App Launch",
    skills: ["React Native", "Firebase"],
    tools: ["Xcode", "Android Studio", "Figma"],
    teamMembers: [employees[4], employees[5]],
    description: "Cross-platform mobile app for field sales team.",
  },
  {
    projectId: "PRJ004",
    title: "Data Warehouse Migration",
    skills: ["SQL", "Python", "AWS Glue"],
    tools: ["dbt", "Airflow", "Redshift"],
    teamMembers: [employees[6], employees[7], employees[8]],
    description: "Migrated on-premise data warehouse to AWS cloud infrastructure.",
  },
  {
    projectId: "PRJ005",
    title: "HR Onboarding Portal",
    skills: ["Vue.js", "Node.js", "MySQL"],
    tools: ["Jira", "Notion"],
    teamMembers: [employees[1], employees[9]],
    description: "Self-service onboarding portal for new hires.",
  },
  {
    projectId: "PRJ006",
    title: "Inventory Management System",
    skills: ["Java", "Spring Boot", "Oracle DB"],
    tools: ["Jenkins", "SonarQube"],
    teamMembers: [employees[3], employees[6]],
    description: "Real-time inventory tracking across 12 warehouses.",
  },
  {
    projectId: "PRJ007",
    title: "Email Marketing Platform",
    skills: ["Python", "Celery", "Redis"],
    tools: ["SendGrid", "Docker"],
    teamMembers: [employees[7], employees[8], employees[9]],
    description: "Scalable bulk email campaign platform with analytics.",
  },
  {
    projectId: "PRJ008",
    title: "API Gateway Consolidation",
    skills: ["Go", "Kubernetes", "gRPC"],
    tools: ["Prometheus", "Grafana", "Helm"],
    teamMembers: [employees[0], employees[5]],
    description: "Consolidated 14 microservice APIs into a single gateway.",
  },
];

// leaveEmps[0–8] = EMP091–EMP099 (the 9 on-leave employees)
// Distribute: 2 per ongoing project (PRJ009–PRJ012) + 1 for PRJ013
const ongoingProjects = [
  {
    projectId: "PRJ009",
    title: "CRM Dashboard v2",
    skills: ["React", "Tailwind CSS", "Node.js"],
    tools: ["Figma", "GitHub", "Jira"],
    teamMembers: [employees[0], employees[1], leaveEmps[0], leaveEmps[1]],
    description: "Building a rich analytics dashboard for CRM admins.",
  },
  {
    projectId: "PRJ010",
    title: "AI Chatbot Integration",
    skills: ["Python", "OpenAI API", "FastAPI"],
    tools: ["LangChain", "Docker", "Slack"],
    teamMembers: [employees[4], employees[5], leaveEmps[2], leaveEmps[3]],
    description: "Integrating an LLM-based assistant into the helpdesk system.",
  },
  {
    projectId: "PRJ011",
    title: "Cloud Cost Optimiser",
    skills: ["AWS", "Terraform", "Python"],
    tools: ["Cost Explorer", "CloudWatch"],
    teamMembers: [employees[6], employees[7], leaveEmps[4], leaveEmps[5]],
    description: "Automated cloud resource right-sizing and cost alerts.",
  },
  {
    projectId: "PRJ012",
    title: "Real-time Notification Service",
    skills: ["Node.js", "Socket.io", "Redis"],
    tools: ["GitHub Actions", "Datadog"],
    teamMembers: [employees[8], employees[9], leaveEmps[6], leaveEmps[7]],
    description: "Push notification service handling 50K events/sec.",
  },
  {
    projectId: "PRJ013",
    title: "Security Audit & Hardening",
    skills: ["Penetration Testing", "OWASP", "Bash"],
    tools: ["Burp Suite", "Nessus", "Confluence"],
    teamMembers: [employees[0], employees[3], employees[6], leaveEmps[8]],
    description: "Full security audit and vulnerability patching of core services.",
  },
];

// ── 2 Pending projects (PRJ014–PRJ015) — same on-leave employees as ongoing ──
const pendingProjects = [
  {
    projectId: "PRJ014",
    title: "Employee Self-Service Portal",
    skills: ["React", "GraphQL", "PostgreSQL"],
    tools: ["Figma", "Postman", "Jira"],
    teamMembers: [employees[1], employees[2], leaveEmps[0], leaveEmps[2], leaveEmps[4]],
    description: "Self-service leave, payslip, and profile management for employees.",
  },
  {
    projectId: "PRJ015",
    title: "Analytics & Reporting Suite",
    skills: ["Python", "Power BI", "SQL"],
    tools: ["Tableau", "dbt", "Airflow"],
    teamMembers: [employees[5], employees[7], leaveEmps[1], leaveEmps[5], leaveEmps[7]],
    description: "Unified reporting suite across sales, HR, and finance verticals.",
  },
];

function buildDoc(p, status) {
  return {
    _id:         new mongoose.Types.ObjectId(),
    projectId:   p.projectId,
    title:       p.title,
    manager:     manager.name,
    email:       manager.email,
    skills:      p.skills,
    tools:       p.tools,
    status,
    description: p.description,
    teamMembers: p.teamMembers.map(member),
    statusFlag:  true,
    createdAt:   new Date(),
    updatedAt:   new Date(),
  };
}

const docs = [
  ...completedProjects.map(p => buildDoc(p, "Completed")),
  ...ongoingProjects.map(p  => buildDoc(p, "Ongoing")),
  ...pendingProjects.map(p  => buildDoc(p, "Pending")),
];

await projectCol.insertMany(docs);
console.log(`\n✅ Inserted ${docs.length} projects`);
console.log(`   ✅ Completed : 8  (PRJ001–PRJ008)`);
console.log(`   🔄 Ongoing   : 5  (PRJ009–PRJ013)`);
console.log(`   ⏳ Pending   : 2  (PRJ014–PRJ015)`);
console.log(`   👥 Employees : ${employees.map(e => e.employeeId).join(", ")}`);

await mongoose.disconnect();
process.exit(0);