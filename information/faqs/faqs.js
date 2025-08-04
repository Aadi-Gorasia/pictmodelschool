document.addEventListener('DOMContentLoaded', function () {
    const faqItems = document.querySelectorAll('.faq-item');

    faqItems.forEach(item => {
        const questionButton = item.querySelector('.faq-question');
        const answerDiv = item.querySelector('.faq-answer');
        // Ensure the selector targets the icon correctly within its structure
        const iconElement = questionButton.querySelector('div > i.fas');

        questionButton.addEventListener('click', () => {
            const isActive = item.classList.contains('active');

            // Optional: Close other open FAQs if you want only one open at a time
            // faqItems.forEach(otherItem => {
            //     if (otherItem !== item && otherItem.classList.contains('active')) {
            //         otherItem.classList.remove('active');
            //         const otherAnswer = otherItem.querySelector('.faq-answer');
            //         otherAnswer.style.maxHeight = '0';
            //         // otherAnswer.style.paddingTop = '0';
            //         // otherAnswer.style.paddingBottom = '0';
            //         const otherIcon = otherItem.querySelector('div > i.fas');
            //         if (otherIcon) {
            //             otherIcon.classList.remove('fa-minus-circle');
            //             otherIcon.classList.add('fa-plus-circle');
            //         }
            //         otherItem.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
            //     }
            // });

            item.classList.toggle('active');
            questionButton.setAttribute('aria-expanded', item.classList.contains('active'));

            if (item.classList.contains('active')) {
                answerDiv.style.maxHeight = answerDiv.scrollHeight + "px";
                // answerDiv.style.paddingTop = '15px'; // Now handled by p tag inside
                // answerDiv.style.paddingBottom = '15px';
                if (iconElement) {
                    iconElement.classList.remove('fa-plus-circle');
                    iconElement.classList.add('fa-minus-circle');
                }
            } else {
                answerDiv.style.maxHeight = '0';
                // answerDiv.style.paddingTop = '0';
                // answerDiv.style.paddingBottom = '0';
                if (iconElement) {
                    iconElement.classList.remove('fa-minus-circle');
                    iconElement.classList.add('fa-plus-circle');
                }
            }
        });
    });
});
