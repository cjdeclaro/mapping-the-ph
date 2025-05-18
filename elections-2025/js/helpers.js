function cleanString(string) {
  if (typeof string !== "string" || string === null) {
    return string; // or return "" or handle however you want for invalid input
  }
  return string.replace(/�/g, "ñ");
}
