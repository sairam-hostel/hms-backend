export default [
  { path: "./src/auth/auth-faculty.js", prefix: "/bf1/auth" },
  { path: "./src/auth/auth-students.js", prefix: "/bs1/auth" },

  { path: "./src/accounts/creation-students.js", prefix: "/bf1/accounts/students" },
  { path: "./src/accounts/creation-faculty.js", prefix: "/bf1/accounts/faculty" },

  { path: "./src/profilepic/profile-img-faculty.js", prefix: "/bf1/profile/image" },
  { path: "./src/profilepic/profile-img-students.js", prefix: "/bs1/profile/image" },

  { path: "./src/profile/profile-students.js", prefix: "/bs1/profile" },
  { path: "./src/profile/profile-faculty.js", prefix: "/bf1/profile" },

  { path: "./src/dashboard/dashboard-faculty.js", prefix: "/bf1/dashboard" },
  // { path: "./src/dashboard/dashboard-students.js", prefix: "/bs1/dashboard" },

  { path: "./src/leave-outpass/leave-outpass-students.js", prefix: "/bs1/leave-outpass" },
  { path: "./src/leave-outpass/leave-outpass-faculty.js", prefix: "/bf1/leave-outpass" },

  { path: "./src/notices/notices-faculty.js", prefix: "/bf1/notices" },
  { path: "./src/notices/notices-students.js", prefix: "/bs1/notices" },

  // { path: "./src/room-management/room-student.js", prefix: "/bs1/rooms" },
  // { path: "./src/room-management/room-faculty.js", prefix: "/bf1/rooms" },

  { path: "./src/complaints/complaints-students.js", prefix: "/bs1/complaints" },
  { path: "./src/complaints/complaints-faculty.js", prefix: "/bf1/complaints" },

  // { path: "./src/fees/fees-student.js", prefix: "/bs1/fees" },
  // { path: "./src/fees/fees-faculty.js", prefix: "/bf1/fees" },

  //outside urls
  { path: "./src/leave-outpass/leave-outpass.js", prefix: "/bf1/review" },

  //utils
  { path: "./src/common/deleteuser.js", prefix: "/b1/delete" },
];
