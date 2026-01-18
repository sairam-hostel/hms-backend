function getMentorReviewHTML({ token, actionUrl }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Leave / Outpass Request Review</title>

<style>
  body {
    font-family: Arial, sans-serif;
    padding: 24px;
    margin: 0;
    background: #f9f9f9;
    color: #333;
  }
  .container {
    max-width: 1000px;
    margin: auto;
    background: #fff;
    padding: 20px 30px;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }
  h1 {
    margin-top: 0;
  }
  .section {
    margin-bottom: 24px;
  }
  .section-title {
    font-size: 1.3em;
    font-weight: bold;
    border-bottom: 2px solid #eee;
    padding-bottom: 6px;
    margin-bottom: 12px;
    color: #444;
  }
  .field {
    display: flex;
    flex-wrap: wrap;
    margin-bottom: 8px;
  }
  .label {
    width: 220px;
    font-weight: bold;
    color: #555;
  }
  .value {
    flex: 1;
    color: #222;
  }
  textarea {
    width: 100%;
    height: 100px;
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 4px;
  }
  .actions {
    margin-top: 20px;
    display: flex;
    gap: 12px;
  }
  button {
    padding: 12px 20px;
    font-size: 1em;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  .approve {
    background: #28a745;
    color: white;
  }
  .reject {
    background: #dc3545;
    color: white;
  }
</style>
</head>

<body>
<div class="container">
  <h1>Leave / Outpass Request Mentor Review</h1>

  <div id="content">Loading details…</div>

  <form method="POST" action="${actionUrl}">
    <input type="hidden" name="token" value="${token}" />

    <div class="actions">
      <button type="submit" name="action" value="approved" class="approve">
        Approve
      </button>
      <button type="submit" name="action" value="rejected" class="reject">
        Reject
      </button>
    </div>

    <div style="margin-top: 10px;">
      <textarea name="remarks" placeholder="Remarks (optional)"></textarea>
    </div>
  </form>
</div>

<script>
  const token = "${token}";

  function safe(val) {
    if (val === undefined || val === null || val === "") return "—";
    return val;
  }

  function section(title, fields) {
    return \`
      <div class="section">
        <div class="section-title">\${title}</div>
        \${fields.map(f => \`
          <div class="field">
            <span class="label">\${f.label}:</span>
            <span class="value">\${safe(f.value)}</span>
          </div>
        \`).join("")}
      </div>
    \`;
  }

  fetch("/bf1/review/mentor?token=" + encodeURIComponent(token))
    .then(async res => {
      if (!res.ok) throw new Error("invalid");
      return res.json();
    })
    .then(({ student, leave }) => {
      document.getElementById("content").innerHTML = \`

        \${section("Student Basic Profile", [
          { label: "Name", value: student.name },
          { label: "Auth User ID", value: student.auth_user_id },
          { label: "Primary Email", value: student.email },
          { label: "Roll Number", value: student.roll_number },
          { label: "Register Number", value: student.register_number },
          { label: "Department", value: student.department },
          { label: "Year", value: student.year },
          { label: "Section", value: student.section },
          { label: "Batch", value: student.batch },
          { label: "Gender", value: student.gender },
          { label: "Date of Birth", value: student.dob },
          { label: "Blood Group", value: student.blood_group },
          { label: "Nationality", value: student.nationality },
          { label: "Religion", value: student.religion },
          { label: "Community", value: student.community }
        ])}

        \${section("Contact Information", [
          { label: "Phone", value: student.phone },
          { label: "Alternate Phone", value: student.alternate_phone },
          { label: "WhatsApp", value: student.whatsapp_number },
          { label: "Father Name", value: student.father_name },
          { label: "Father Phone", value: student.father_phone },
          { label: "Father Email", value: student.father_email },
          { label: "Mother Name", value: student.mother_name },
          { label: "Mother Phone", value: student.mother_phone },
          { label: "Mother Email", value: student.mother_email },
          { label: "Guardian Name", value: student.guardian_name },
          { label: "Guardian Phone", value: student.guardian_phone },
          { label: "Guardian Email", value: student.guardian_email }
        ])}

        \${section("Hostel Details", [
          { label: "Hostel Block", value: student.hostel_block },
          { label: "Room Number", value: student.room_number },
          { label: "Bed Number", value: student.bed_number },
          { label: "Floor", value: student.floor },
          { label: "Warden Name", value: student.warden_name },
          { label: "Food Type", value: student.food_type }
        ])}

        \${section("Academic Snapshot", [
          { label: "Internal Marks", value: student.internal_marks },
          { label: "External Marks", value: student.external_marks },
          { label: "Total Marks", value: student.total_marks },
          { label: "Percentage", value: student.percentage },
          { label: "Attendance %", value: student.attendance_percentage },
          { label: "Grade", value: student.grade },
          { label: "GPA", value: student.gpa },
          { label: "CGPA", value: student.cgpa },
          { label: "Result Status", value: student.result_status },
          { label: "Academic Status", value: student.academic_status }
        ])}

        \${section("Authorities", [
          { label: "Mentor Name", value: student.mentor_name },
          { label: "Mentor Email", value: student.mentor_email },
          { label: "Mentor Phone", value: student.mentor_phone },
          { label: "Coordinator Name", value: student.class_coordinator_name },
          { label: "Coordinator Email", value: student.class_coordinator_email },
          { label: "Coordinator Phone", value: student.class_coordinator_phone },
          { label: "HOD Name", value: student.hod_name },
          { label: "HOD Email", value: student.hod_email },
          { label: "HOD Phone", value: student.hod_phone },
          { label: "Warden Email", value: student.assigned_warden_email },
          { label: "Warden Phone", value: student.assigned_warden_phone }
        ])}

        \${section("Address", [
          { label: "Address Line 1", value: student.address_line_1 },
          { label: "Address Line 2", value: student.address_line_2 },
          { label: "City", value: student.city },
          { label: "State", value: student.state },
          { label: "Pincode", value: student.pincode },
          { label: "Permanent Address", value: student.permanent_address }
        ])}

        \${section("School Details", [
          { label: "School Name", value: student.school_name },
          { label: "School Board", value: student.school_board },
          { label: "School %", value: student.school_percentage }
        ])}

        \${section("Leave / Outpass Information", [
          { label: "Type", value: leave.type },
          { label: "From Date", value: leave.from_date },
          { label: "To Date", value: leave.to_date },
          { label: "Return Date", value: leave.return_date },
          { label: "Reason", value: leave.request_reason },
          { label: "Place to Visit", value: leave.place_to_visit },
          { label: "Address Details", value: leave.address_details },
          { label: "Mode of Transport", value: leave.mode_of_transport },
          { label: "Expected In Time", value: leave.expected_in_time },
          { label: "Pickup Person Name", value: leave.pickup_person_name },
          { label: "Pickup Person Relation", value: leave.pickup_person_relation },
          { label: "Pickup Person Phone", value: leave.pickup_person_phone },
          { label: "Pickup Person ID Type", value: leave.pickup_person_id_type },
          { label: "Pickup Person ID Number", value: leave.pickup_person_id_number }
        ])}
      \`;
    })
    .catch(() => {
      document.getElementById("content").innerHTML =
        "<p>Invalid or expired link.</p>";
    });
</script>

</body>
</html>
`;
}

module.exports = getMentorReviewHTML;
