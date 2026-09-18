document.addEventListener("DOMContentLoaded", function () {
    // 1. TYPING RESET & START
    const typingText = document.getElementById("typing-text");
    if (typingText) {
        typingText.textContent = ""; // THE FIX: Wipes ghost ">" immediately
        const words = ["Excellence in Education", "Innovative Curriculum", "Enroll Today!"];
        let wIdx = 0, charIdx = 0, isDeleting = false;

        function play() {
            const current = words[wIdx];
            typingText.textContent = isDeleting ? current.substring(0, charIdx--) : current.substring(0, charIdx++);
            
            let speed = isDeleting ? 40 : 80;
            if (!isDeleting && charIdx > current.length) { speed = 2000; isDeleting = true; }
            if (isDeleting && charIdx < 0) { isDeleting = false; wIdx = (wIdx + 1) % words.length; charIdx = 0; speed = 500; }
            setTimeout(play, speed);
        }
        play();
    }

    // 2. SLIDER SAFETY
    const slider = document.querySelector('.slider .list');
    const dots = document.querySelectorAll('.slider .dots li');
    if (slider && dots.length > 0) {
        let active = 0;
        setInterval(() => {
            // If the sidebar is open, user is editing. STOP the slider.
            if(document.getElementById('cms-sidebar')?.classList.contains('active')) return;
            
            active = (active + 1) % dots.length;
            slider.style.transform = `translateX(-${active * 100}%)`;
            
            const currentActive = document.querySelector('.dots li.active');
            if (currentActive) currentActive.classList.remove('active');
            if (dots[active]) dots[active].classList.add('active');
        }, 4000);
    }
});