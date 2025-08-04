document.addEventListener('DOMContentLoaded', () => {
    const filterButtons = document.querySelectorAll('.filter-btn');
    const cards = document.querySelectorAll('.card');

    // Function to handle the filtering
    const filterCards = (filterValue) => {
        cards.forEach(card => {
            const cardCategory = card.getAttribute('data-category');

            // Condition to show the card
            const shouldShow = (filterValue === 'all' || cardCategory === filterValue);
            
            if (shouldShow) {
                card.classList.remove('hidden');
            } else {
                card.classList.add('hidden');
            }
        });
    };

    // Add click event listeners to buttons
    filterButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            // Prevent default link behavior if any
            e.preventDefault();

            // Remove 'active' class from all buttons
            filterButtons.forEach(btn => btn.classList.remove('active'));
            
            // Add 'active' class to the clicked button
            button.classList.add('active');

            // Get the filter value and call the filter function
            const filterValue = button.getAttribute('data-filter');
            filterCards(filterValue);
        });
    });

    // Optional: Trigger the 'all' filter on initial load
    filterCards('all');
});