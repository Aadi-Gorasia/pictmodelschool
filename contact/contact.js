document.addEventListener('DOMContentLoaded', () => {

    const textSpan = document.getElementById('typing-text');
    const cursorSpan = document.querySelector('#typing-heading .cursor');

    if (textSpan && cursorSpan) {

        const phrasesToType = [
            "Get In Touch",
            "Ask Us Anything",
            "We're Here To Help",
            "Visit Our School"
            
        ];
        

        const typingSpeed = 130;
        const deletingSpeed = 75;
        const pauseDuration = 1500;
        const initialDelay = 500;

        let phraseIndex = 0;
        let charIndex = 0;
        let isDeleting = false;

        function typeWriter() {
            
            const currentFullText = phrasesToType[phraseIndex];

            
            let timeoutDuration = isDeleting ? deletingSpeed : typingSpeed;

            
            if (isDeleting) {
                
                textSpan.textContent = currentFullText.substring(0, charIndex - 1);
                charIndex--;
            } else {
                
                textSpan.textContent = currentFullText.substring(0, charIndex + 1);
                charIndex++;
            }

             
             
            const isPaused = (isDeleting && charIndex === 0) || (!isDeleting && charIndex === currentFullText.length);
            cursorSpan.style.animation = isPaused ? 'blink 1s step-end infinite' : 'none';


            
            if (!isDeleting && charIndex === currentFullText.length) {
                
                isDeleting = true; 
                timeoutDuration = pauseDuration; 
            } else if (isDeleting && charIndex === 0) {
                
                isDeleting = false; 
                timeoutDuration = pauseDuration; 

                
                phraseIndex = (phraseIndex + 1) % phrasesToType.length; 
                
            }

            
            setTimeout(typeWriter, timeoutDuration);
        }

        
        textSpan.textContent = ''; 
        cursorSpan.style.animation = 'blink 1s step-end infinite'; 
        
        setTimeout(typeWriter, initialDelay);

    } else {
        
        if (!textSpan) console.error("Typing animation Error: #typing-text element not found.");
        if (!cursorSpan) console.error("Typing animation Error: .cursor element not found.");
    }

});