function toggleSection(sectionId) {
  const sections = document.querySelectorAll(".content-box");

  if (sectionId === 'all') {
    sections.forEach(section => {
      section.style.display = "block";
    });
  } else {
    sections.forEach(section => {
      section.style.display = section.id === sectionId ? "block" : "none";
    });
  }
}
