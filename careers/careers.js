    document.addEventListener('DOMContentLoaded', function() {

        
        const tabs = document.querySelectorAll('.requirements-tabs .tab-item');
        const panes = document.querySelectorAll('.requirements-content .tab-pane');

        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetId = tab.getAttribute('data-tab');
                const targetPane = document.getElementById(targetId);

                if (!targetPane) {
                    console.error(`Tab content pane with ID "${targetId}" not found.`);
                    return;
                }

                tabs.forEach(t => {
                    t.classList.remove('active');
                });
                panes.forEach(p => {
                    p.classList.remove('active');
                });

                tab.classList.add('active');
                targetPane.classList.add('active');
            });
        });
    }); 



    document.addEventListener('DOMContentLoaded', function() {

        const categorySelect = document.getElementById('postCategory');
        const subPostSelect = document.getElementById('subPost');

        if (categorySelect && subPostSelect) {
            const subPostsData = {
                primary: ["English Teacher", "EVS Teacher", "Math Teacher", "ICT Teacher"],
                language: ["Hindi Teacher", "Marathi Teacher", "Sanskrit Teacher", "French Teacher", "German Teacher"],
                secondary: ["Subject Teacher - Science", "Subject Teacher - Maths", "Subject Teacher - Social Science", "Subject Teacher - English", "Subject Teacher - Computer"],
                senior_secondary: ["PGT Physics", "PGT Chemistry", "PGT Biology", "PGT Maths", "PGT Accountancy", "PGT English"],
                arts: ["Vocal Music Teacher", "Dance Teacher", "Art Teacher", "Instrumental Teacher"],
                sports: ["Physical Education Teacher", "Coach - Basketball", "Coach - Football", "Yoga Instructor"],
                non_teaching: ["Admin Officer", "Librarian", "Accountant", "IT Support Staff", "Receptionist", "Lab Assistant"]
            };

            function updateSubPosts() {
                const selectedCategory = categorySelect.value;
                const subOptions = subPostsData[selectedCategory] || [];

                subPostSelect.innerHTML = '<option value="" disabled selected>Select Sub Post</option>'; 

                if (subOptions.length > 0) {
                    subPostSelect.disabled = false;
                    subOptions.forEach(optionText => {
                        const option = document.createElement('option');
                        option.value = optionText.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); 
                        option.textContent = optionText;
                        subPostSelect.appendChild(option);
                    });
                } else {
                    subPostSelect.disabled = true;
                    subPostSelect.innerHTML = '<option value="" disabled selected>Select Category First</option>';
                }
            }

            categorySelect.addEventListener('change', updateSubPosts);
        } else {
            console.error("Could not find category or sub-post select elements.");
        }


        // === Tab Functionality ===
        const tabs = document.querySelectorAll('.requirements-tabs .tab-item');
        const panes = document.querySelectorAll('.requirements-content .tab-pane');

        if (tabs.length > 0 && panes.length > 0) {
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    const targetId = tab.getAttribute('data-tab');
                    const targetPane = document.getElementById(targetId);
                    if (!targetPane) {
                        console.error(`Tab content pane with ID "${targetId}" not found.`);
                        return;
                    }

                    tabs.forEach(t => t.classList.remove('active'));
                    panes.forEach(p => p.classList.remove('active'));

                    tab.classList.add('active');
                    targetPane.classList.add('active');
                });
            });
        }

        const yearSpan = document.getElementById('current-year');
        if(yearSpan){
            yearSpan.textContent = new Date().getFullYear();
        }


    });
