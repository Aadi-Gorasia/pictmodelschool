document.addEventListener('DOMContentLoaded', function() {
    const eventButtons = document.querySelectorAll('.event-btn');
    const eventContents = document.querySelectorAll('.event-content');
    const pageBanner = document.getElementById('page-banner');
    const bannerTitle = document.getElementById('banner-title');

    // Define banner details for each event
    const eventDetails = {
        pondicherry: {
            title: 'Pondicherry Trip 2023-24',
            bannerUrl: 'url("https://www.pictmodelschool.edu.in/images/pondicherry/banner.jpg")'
        },
        monteria: {
            title: 'Monteria Village Trip 2023-24',
            bannerUrl: 'url("https://www.pictmodelschool.edu.in/images/Monteria_vilage/banner.jpg")'
        },
        jaisalmer: {
            title: 'Jaisalmer & Jodhpur Trip 2023-24',
            bannerUrl: 'url("https://www.pictmodelschool.edu.in/images/jaisalmer_jodhpur/banner.jpg")'
        },
        teachersday: {
            title: 'Teacher\'s Day Celebration',
            bannerUrl: 'url("https://www.pictmodelschool.edu.in/images/teachersday/banner.jpg")'
        },
        archives: {
            title: 'Archives'
        }
        
    };

    // Set the initial banner on page load
    pageBanner.style.backgroundImage = eventDetails.pondicherry.bannerUrl;

    eventButtons.forEach(button => {
        button.addEventListener('click', function() {
            const selectedEvent = this.getAttribute('data-event');

            // Update Active Button
            eventButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');

            // Switch Active Content
            eventContents.forEach(content => {
                if (content.id === selectedEvent + '-content') {
                    content.classList.add('active');
                } else {
                    content.classList.remove('active');
                }
            });

            // Update Banner and Title
            if (eventDetails[selectedEvent]) {
                pageBanner.style.backgroundImage = eventDetails[selectedEvent].bannerUrl;
                bannerTitle.textContent = eventDetails[selectedEvent].title;
            }
        });
    });
});