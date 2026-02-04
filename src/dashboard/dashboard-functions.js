import { Student } from "../accounts/creation-students.js";
import { Faculty } from "../accounts/creation-faculty.js";
import { Notice } from "../notices/notices-faculty.js";
import { Complaint } from "../complaints/complaints-students.js";
import { LeaveOutpass } from "../leave-outpass/leave-outpass-students.js";

export const DEPARTMENTS = [
    "Civil Engineering",
    "Computer Science and Engineering (CSE)",
    "Electronics & Communication Engineering (ECE)",
    "Electrical & Electronics Engineering (EEE)",
    "Electronics & Instrumentation Engineering (EIE)",
    "Instrumentation & Control Engineering",
    "Mechanical Engineering",
    "Production Engineering",
    "Information Technology (IT)",
    "Artificial Intelligence & Data Science (AI & DS)",
    "Computer Science & Business Systems (CSBS)",
    "Mechanical & Automation Engineering",
    "Humanities & Sciences",
    "Management Studies (MBA)",
    "M.Tech Computer Science (5yrs)"
];

export const getStudentCountYearWise=async(year)=>{
    return await Student.countDocuments({ year: String(year) });
}

export const getTotalMembers=async(member)=>{
    if(member==="students")
        return await Student.countDocuments();
    else if(member==="faculties")
        return await Faculty.countDocuments();
    else
        return await Faculty.countDocuments() + await Student.countDocuments();
}

export const getStudentCountDepartmentWise = async () => {
    const result = {};

    for (const dept of DEPARTMENTS) 
    {
        result[dept] = await Student.countDocuments({
            department: dept
        });
    }

    return result;
};

export const getNoticeCounts=async(status)=>{
    if(status==="active")
        return await Notice.countDocuments({is_active:true})
    else
        return 0;
}

export const getRecentNotices = async (count) => {
    return await Notice.find({}, { message: 1, category: 1, created_at: 1, _id: 0 })
        .sort({ created_at: -1 })
        .limit(count)
        .lean();
};

export const getCgpaBasedCounts=async (filter)=>{
    if(filter===">=8")
    {
        return await Student.countDocuments({
            cgpa: { $gte: 8 }
        });
    }
    else if(filter==="<8")
    {
        return await Student.countDocuments({
            cgpa: { $lt: 8 }
        });
    }
}

export const getPendingComplaints=async()=>{
    return await Complaint.countDocuments({ status: "pending" });
}

export const getPendingRequests=async(type)=>{
    return await LeaveOutpass.countDocuments({ 
        admin_status: "pending",
        type
    });
}