// main.js

document.addEventListener('DOMContentLoaded', () => {
    // Add event listener only after DOM is ready

    // --- Global Click Listener to Close Menu ---
    document.addEventListener('click', function(event) {
        const menuToggle = document.getElementById('menu-toggle');
        // Ensure menuToggle exists before proceeding
        if (!menuToggle) return;

        const navbar = document.querySelector('.navbar');
        const sliderControls = document.querySelector('.slider .buttons, .slider .dots'); // Target slider buttons OR dots area

        // Check if the clicked element exists and is part of the DOM
        if (!event.target || !document.body.contains(event.target)) {
             return; // Ignore clicks on detached elements
        }

        // Determine if the click occurred inside the slider controls
        const isClickInsideSliderControls = sliderControls && sliderControls.contains(event.target);

        // Determine if the click occurred inside the navbar
        const isClickInsideNavbar = navbar && navbar.contains(event.target);


        // Close menu ONLY if:
        // 1. The menu toggle checkbox is checked (menu is open)
        // 2. The click was NOT inside the navbar
        // 3. The click was NOT inside the slider controls (buttons or dots)
        if (menuToggle.checked && !isClickInsideNavbar && !isClickInsideSliderControls) {
            menuToggle.checked = false; // Close the menu
        }
    });

    // --- Footer Year Update ---
    const currentYearSpan = document.getElementById('current-year');
    if (currentYearSpan) {
        currentYearSpan.textContent = new Date().getFullYear();
    }

    // --- Any other general JS code from main.js can go here ---

}); // End DOMContentLoaded

// main.js

document.addEventListener('DOMContentLoaded', () => {

    // --- Scroll-to-Top Button Logic ---
    const scrollToTopBtn = document.getElementById('scrollToTopBtn');
    const scrollThreshold = 300; // Pixels scrolled before button appears

    if (scrollToTopBtn) {
        // Function to check scroll position and toggle button visibility
        const checkScroll = () => {
            if (window.pageYOffset > scrollThreshold) {
                scrollToTopBtn.classList.add('visible');
            } else {
                scrollToTopBtn.classList.remove('visible');
            }
        };

        // Listen for scroll events
        window.addEventListener('scroll', checkScroll);

        // Listen for click events on the button
        scrollToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth' // Smooth scroll animation
            });
        });

        // Initial check in case the page is already scrolled down on load
        checkScroll();
    }

    // --- Global Click Listener to Close Menu (Keep Existing Code) ---
    document.addEventListener('click', function(event) {
        const menuToggle = document.getElementById('menu-toggle');
        if (!menuToggle) return;
        const navbar = document.querySelector('.navbar');
        const sliderControls = document.querySelector('.slider .buttons, .slider .dots');
        if (!event.target || !document.body.contains(event.target)) return;
        const isClickInsideSliderControls = sliderControls && sliderControls.contains(event.target);
        const isClickInsideNavbar = navbar && navbar.contains(event.target);
        if (menuToggle.checked && !isClickInsideNavbar && !isClickInsideSliderControls) {
            menuToggle.checked = false;
        }
    });

    // --- Footer Year Update (Keep Existing Code) ---
    const currentYearSpan = document.getElementById('current-year');
    if (currentYearSpan) {
        currentYearSpan.textContent = new Date().getFullYear();
    }

    // --- Any other general JS code ---

}); // End DOMContentLoaded

// main.js

document.addEventListener('DOMContentLoaded', () => {

    // --- Initialize AOS (Animate On Scroll) ---
    AOS.init({
        duration: 800, // Animation duration in ms
        offset: 120,   // Offset (in px) from the original trigger point
        once: true,    // Whether animation should happen only once - while scrolling down
        easing: 'ease-in-out', // Default easing
        // More options: https://github.com/michalsnik/aos#configuration
    });

    // --- Scroll-to-Top Button Logic (Keep Existing Code) ---
    const scrollToTopBtn = document.getElementById('scrollToTopBtn');
    const scrollThreshold = 300;
    if (scrollToTopBtn) {
        const checkScroll = () => { /* ... */ };
        window.addEventListener('scroll', checkScroll);
        scrollToTopBtn.addEventListener('click', () => { /* ... */ });
        checkScroll();
    }
    // Make sure checkScroll function and click listener content are here

    // --- Global Click Listener to Close Menu (Keep Existing Code) ---
    document.addEventListener('click', function(event) { /* ... */ });
    // Make sure the full click listener code is here

    // --- Footer Year Update (Keep Existing Code) ---
    const currentYearSpan = document.getElementById('current-year');
    if (currentYearSpan) { /* ... */ }
    // Make sure the year update code is here

    // --- Optional: Subtle Button Click Feedback ---
    const animatedButtons = document.querySelectorAll('.enroll, .btn-primary button, .btn-submit'); // Select buttons to animate
    animatedButtons.forEach(button => {
        button.addEventListener('mousedown', () => {
            button.style.transform = 'scale(0.97)'; // Scale down slightly on press
            button.style.transition = 'transform 0.1s ease';
        });
        button.addEventListener('mouseup', () => {
            button.style.transform = 'scale(1)'; // Scale back on release
        });
        // Reset if mouse leaves while pressed
        button.addEventListener('mouseleave', () => {
             button.style.transform = 'scale(1)';
        });
    });


}); // End DOMContentLoaded