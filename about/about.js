document.addEventListener("DOMContentLoaded", function () {
    const typedTarget = document.getElementById("typed-title");

    if (typedTarget) {
        var typed = new Typed("#typed-title", {
            strings: ["About Us", "Our Story", "Our Values"], 
            typeSpeed: 80, 
            backSpeed: 40,
            backDelay: 1800,
            startDelay: 500,
            loop: true,
            showCursor: true, 
            cursorChar: '|',
        });
    } else {
        console.warn("Typed.js target element (#typed-title) not found on this page.");
        const placeholder = document.getElementById("typed-title-placeholder");
        if (placeholder) {
            placeholder.textContent = "About Us";
        }
    }
});