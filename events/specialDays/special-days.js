// special-days.js

document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('.carousel-nav a');
    const carouselContents = document.querySelectorAll('.carousel-content');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault(); 

            const targetId = link.getAttribute('data-target');
            const targetContent = document.getElementById(targetId);

            // Remove 'active' from all links and content
            navLinks.forEach(navLink => navLink.classList.remove('active'));
            carouselContents.forEach(content => content.classList.remove('active'));

            // Add 'active' to the clicked link and its content
            link.classList.add('active');
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
});