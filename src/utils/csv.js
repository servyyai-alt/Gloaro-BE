const exportToCSV = (res, data, fields, filename = "export.csv") => {
  const header = fields.map(f => typeof f === "string" ? f : f.label).join(",");
  const rows = data.map(row => 
    fields.map(f => {
      const key = typeof f === "string" ? f : f.key;
      let val = row;
      // Handle nested paths like address.city
      key.split(".").forEach(part => {
        val = val ? val[part] : "";
      });
      if (val === undefined || val === null) val = "";
      if (typeof val === "object" && !(val instanceof Date)) val = JSON.stringify(val);
      val = String(val).replace(/"/g, '""');
      return `"${val}"`;
    }).join(",")
  );
  const csvContent = [header, ...rows].join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
  return res.status(200).send(csvContent);
};

module.exports = { exportToCSV };
