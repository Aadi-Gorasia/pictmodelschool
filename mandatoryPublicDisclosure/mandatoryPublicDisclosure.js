document.addEventListener('DOMContentLoaded', () => {

    const textSpan = document.getElementById('typing-text');
    const cursorSpan = document.querySelector('#typing-heading .cursor');

    // Check if BOTH elements exist on the current page
    if (textSpan && cursorSpan) {

        // --- !!! EDIT THIS ARRAY WITH YOUR TEXTS !!! ---
        const phrasesToType = [
            "Mandatory Public Disclosure",
            
            // Add as many strings as you like here
        ];
        // ------------------------------------------------

        const typingSpeed = 130;    // Milliseconds between characters when typing
        const deletingSpeed = 75;     // Milliseconds between characters when deleting
        const pauseDuration = 1500;   // Milliseconds to pause after typing/deleting
        const initialDelay = 500;     // Milliseconds before starting the first type

        let phraseIndex = 0; // Index for the phrasesToType array
        let charIndex = 0;   // Index for the character in the current phrase
        let isDeleting = false; // State flag

        function typeWriter() {
            // Get the text for the current phrase index
            const currentFullText = phrasesToType[phraseIndex];

            // Determine the current action and set the timeout duration
            let timeoutDuration = isDeleting ? deletingSpeed : typingSpeed;

            // --- Update Text ---
            if (isDeleting) {
                // Deleting: Remove one character
                textSpan.textContent = currentFullText.substring(0, charIndex - 1);
                charIndex--;
            } else {
                // Typing: Add one character
                textSpan.textContent = currentFullText.substring(0, charIndex + 1);
                charIndex++;
            }

             // --- Control Cursor Blink ---
             // Blink only when paused (finished typing or finished deleting)
            const isPaused = (isDeleting && charIndex === 0) || (!isDeleting && charIndex === currentFullText.length);
            cursorSpan.style.animation = isPaused ? 'blink 1s step-end infinite' : 'none';


            // --- Check for State Change ---
            if (!isDeleting && charIndex === currentFullText.length) {
                // Finished typing the current phrase
                isDeleting = true; // Switch to deleting mode
                timeoutDuration = pauseDuration; // Pause before starting to delete
            } else if (isDeleting && charIndex === 0) {
                // Finished deleting the current phrase
                isDeleting = false; // Switch back to typing mode
                timeoutDuration = pauseDuration; // Pause before typing the next phrase

                // --- Move to the next phrase in the array ---
                phraseIndex = (phraseIndex + 1) % phrasesToType.length; // Use modulo to loop back to the start
                // ---------------------------------------------
            }

            // --- Schedule Next Action ---
            setTimeout(typeWriter, timeoutDuration);
        }

        // --- Initial Setup ---
        textSpan.textContent = ''; // Ensure text span is empty initially
        cursorSpan.style.animation = 'blink 1s step-end infinite'; // Start with blinking cursor
        // Start the first typing animation after the initial delay
        setTimeout(typeWriter, initialDelay);

    } else {
        // Optional: Log if elements aren't found (useful for debugging)
        if (!textSpan) console.error("Typing animation Error: #typing-text element not found.");
        if (!cursorSpan) console.error("Typing animation Error: .cursor element not found.");
    }

}); // End DOMContentLoaded