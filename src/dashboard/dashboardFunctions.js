import { Student } from "../accounts/creation-students";
import { Faculty } from "../accounts/creation-faculty";
import { Notice } from "../notices/notices-faculty";

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

export const getStudentCountDepartmentWise=async(dept)=>{
    return await Student.countDocuments({ department: dept });
}

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