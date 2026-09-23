// home.js - Specific JS for the home page

document.addEventListener("DOMContentLoaded", function () {

    // --- Typing Effect ---
    const typingTextElement = document.getElementById("typing-text");
    const cursorSpan = document.querySelector(".cursor");

    if (typingTextElement && cursorSpan) {
        const textArray = [
            "Excellence in Education",
            "Innovative Curriculum",
            "Holistic Development",
            "State-of-the-Art",
            "Enroll Today!"
        ];
        const typingSpeed = 80;
        const erasingSpeed = 40;
        const delayBeforeErase = 1500;
        const delayBeforeType = 400;

        let textIndex = 0;
        let charIndex = 0;

        function typeEffect() {
            if (charIndex < textArray[textIndex].length) {
                typingTextElement.textContent += textArray[textIndex].charAt(charIndex);
                charIndex++;
                setTimeout(typeEffect, typingSpeed);
            } else {
                cursorSpan.style.animationPlayState = 'paused'; // Pause blinking during delay
                setTimeout(() => {
                     cursorSpan.style.animationPlayState = 'running'; // Resume blinking
                     eraseEffect();
                }, delayBeforeErase);
            }
        }

        function eraseEffect() {
            if (charIndex > 0) {
                typingTextElement.textContent = textArray[textIndex].substring(0, charIndex - 1);
                charIndex--;
                setTimeout(eraseEffect, erasingSpeed);
            } else {
                textIndex = (textIndex + 1) % textArray.length;
                 setTimeout(typeEffect, delayBeforeType);
            }
        }
        // Start the effect
        setTimeout(typeEffect, delayBeforeType);

    } else {
        console.warn("Typing effect elements (#typing-text or .cursor) not found on this page.");
    }


    // --- Carousel / Slider ---
    const slider = document.querySelector('.slider .list');
    const items = document.querySelectorAll('.slider .list .item');
    const nextBtn = document.getElementById('next');
    const prevBtn = document.getElementById('prev');
    const dots = document.querySelectorAll('.slider .dots li');

    if (slider && items.length > 0 && nextBtn && prevBtn && dots.length > 0) {
        let lengthItems = items.length;
        let activeIndex = 0;
        let refreshInterval;

        // Function to move to a specific slide
        function moveToSlide(index) {
            activeIndex = index;
            // Use transform for sliding
            slider.style.transform = `translateX(-${activeIndex * 100}%)`;

            // Update active dot
            document.querySelector('.slider .dots li.active')?.classList.remove('active');
            dots[activeIndex].classList.add('active');

            // Reset auto-slide timer
            resetInterval();
        }

        // Function to reset the auto-slide interval
        function resetInterval() {
            clearInterval(refreshInterval);
            refreshInterval = setInterval(() => nextBtn.click(), 4000); // Auto-slide every 4 seconds
        }

        // Event listeners for next/prev buttons
        nextBtn.onclick = function () {
            let nextIndex = (activeIndex + 1) % lengthItems;
            moveToSlide(nextIndex);
        };

        prevBtn.onclick = function () {
            let prevIndex = (activeIndex - 1 + lengthItems) % lengthItems;
            moveToSlide(prevIndex);
        };

        // Event listeners for dots
        dots.forEach((dot, index) => {
            dot.addEventListener('click', () => {
                moveToSlide(index);
            });
        });

        // Initial setup
        moveToSlide(0); // Start at the first slide

        // Handle window resize to recalculate correctly if needed (transform usually handles this well)
        // window.onresize = () => moveToSlide(activeIndex); // Optional, usually not needed with % transform

    } else {
         console.warn("Slider elements (.slider .list, .item, #next, #prev, .dots li) not found or incomplete on this page.");
    }

}); // End DOMContentLoaded