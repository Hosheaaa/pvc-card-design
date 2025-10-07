document.addEventListener('DOMContentLoaded', () => {
    const imageLoader = document.getElementById('imageLoader');
    const materialSelector = document.getElementById('materialSelector');
    const cardPreview = document.getElementById('card-preview');
    const materialOverlay = document.getElementById('material-overlay');
    const resizableBox = document.getElementById('resizable-box');
    const userImage = document.getElementById('user-image');
    const resizers = document.querySelectorAll('.resizer');

    const defaultImages = {
        matte: 'Matte_black.jpg',
        laser: 'Laser_white.jpg'
    };

    let userUploadedImage = null;
    let isDragging = false;
    let isResizing = false;
    let currentResizer = null;
    let startX, startY, startWidth, startHeight, startLeft, startTop;

    function render() {
        const selectedMaterial = materialSelector.value;
        materialOverlay.className = 'material-overlay'; // Clear all effect classes

        if (userUploadedImage) {
            // --- User Image Mode ---
            cardPreview.style.backgroundImage = 'none'; // Hide default image
            resizableBox.style.display = 'block'; // Show the resizable box
            userImage.src = userUploadedImage;

            // Apply the chosen *effect* to the overlay
            if (selectedMaterial === 'matte') {
                materialOverlay.classList.add('user-image-matte-effect');
            } else if (selectedMaterial === 'laser') {
                materialOverlay.classList.add('user-image-laser-effect');
            }

        } else {
            // --- Default Preview Mode ---
            cardPreview.style.backgroundImage = `url(${defaultImages[selectedMaterial]})`;
            resizableBox.style.display = 'none'; // Hide the resizable box
        }
    }

    // --- Event Listeners ---
    materialSelector.addEventListener('change', render);

    imageLoader.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                userUploadedImage = event.target.result;

                // Create a temporary image to get natural dimensions
                const tempImg = new Image();
                tempImg.src = userUploadedImage;
                tempImg.onload = () => {
                    const cardWidth = cardPreview.offsetWidth;
                    const cardHeight = cardPreview.offsetHeight;
                    const imgWidth = tempImg.naturalWidth;
                    const imgHeight = tempImg.naturalHeight;

                    const cardRatio = cardWidth / cardHeight;
                    const imgRatio = imgWidth / imgHeight;

                    let initialWidth, initialHeight, initialLeft, initialTop;

                    if (imgRatio > cardRatio) {
                        // Image is wider than the card, fit by width
                        initialWidth = cardWidth;
                        initialHeight = cardWidth / imgRatio;
                    } else {
                        // Image is taller or same aspect ratio, fit by height
                        initialHeight = cardHeight;
                        initialWidth = cardHeight * imgRatio;
                    }

                    initialLeft = (cardWidth - initialWidth) / 2;
                    initialTop = (cardHeight - initialHeight) / 2;

                    resizableBox.style.width = `${initialWidth}px`;
                    resizableBox.style.height = `${initialHeight}px`;
                    resizableBox.style.left = `${initialLeft}px`;
                    resizableBox.style.top = `${initialTop}px`;

                    render();
                };
            };
            reader.readAsDataURL(file);
        } else {
            userUploadedImage = null;
            render();
        }
    });

    // --- Dragging Logic for resizableBox ---
    resizableBox.addEventListener('mousedown', (e) => {
        // Allow dragging if the click is not on a resizer
        if (!e.target.classList.contains('resizer')) {
            e.preventDefault();
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = resizableBox.offsetLeft;
            startTop = resizableBox.offsetTop;
            resizableBox.style.cursor = 'grabbing';
        }
    });

    // --- Resizing Logic for resizers ---
    resizers.forEach(resizer => {
        resizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isResizing = true;
            currentResizer = resizer;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = resizableBox.offsetWidth;
            startHeight = resizableBox.offsetHeight;
            startLeft = resizableBox.offsetLeft;
            startTop = resizableBox.offsetTop;
        });
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            resizableBox.style.left = `${startLeft + dx}px`;
            resizableBox.style.top = `${startTop + dy}px`;
        } else if (isResizing) {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            let newWidth = startWidth;
            let newHeight = startHeight;
            let newLeft = startLeft;
            let newTop = startTop;

            switch (currentResizer.classList[1]) {
                case 'top-left':
                    const tl_aspectRatio = startWidth / startHeight;
                    if (Math.abs(dx) > Math.abs(dy)) { // Horizontal movement is dominant
                        newWidth = startWidth - dx;
                        newHeight = newWidth / tl_aspectRatio;
                        newLeft = startLeft + dx;
                        newTop = startTop + (startHeight - newHeight);
                    } else { // Vertical movement is dominant
                        newHeight = startHeight - dy;
                        newWidth = newHeight * tl_aspectRatio;
                        newLeft = startLeft + (startWidth - newWidth);
                        newTop = startTop + dy;
                    }
                    break;
                case 'top-right':
                    const tr_aspectRatio = startWidth / startHeight;
                    if (Math.abs(dx) > Math.abs(dy)) { // Horizontal movement is dominant
                        newWidth = startWidth + dx;
                        newHeight = newWidth / tr_aspectRatio;
                        newTop = startTop + (startHeight - newHeight);
                    } else { // Vertical movement is dominant
                        newHeight = startHeight - dy;
                        newWidth = newHeight * tr_aspectRatio;
                    }
                    break;
                case 'bottom-left':
                    const bl_aspectRatio = startWidth / startHeight;
                    if (Math.abs(dx) > Math.abs(dy)) { // Horizontal movement is dominant
                        newWidth = startWidth - dx;
                        newHeight = newWidth / bl_aspectRatio;
                        newLeft = startLeft + dx;
                    } else { // Vertical movement is dominant
                        newHeight = startHeight + dy;
                        newWidth = newHeight * bl_aspectRatio;
                        newLeft = startLeft + (startWidth - newWidth);
                    }
                    break;
                case 'bottom-right':
                    const br_aspectRatio = startWidth / startHeight;
                    if (Math.abs(dx) > Math.abs(dy)) { // Horizontal movement is dominant
                        newWidth = startWidth + dx;
                        newHeight = newWidth / br_aspectRatio;
                    } else { // Vertical movement is dominant
                        newHeight = startHeight + dy;
                        newWidth = newHeight * br_aspectRatio;
                    }
                    break;
                case 'top':
                    newHeight = startHeight - dy;
                    newTop = startTop + dy;
                    break;
                case 'bottom':
                    newHeight = startHeight + dy;
                    break;
                case 'left':
                    newWidth = startWidth - dx;
                    newLeft = startLeft + dx;
                    break;
                case 'right':
                    newWidth = startWidth + dx;
                    break;
            }

            // Apply new dimensions and position, ensuring minimum size
            if (newWidth > 50) {
                resizableBox.style.width = `${newWidth}px`;
                resizableBox.style.left = `${newLeft}px`;
            }
            if (newHeight > 50) {
                resizableBox.style.height = `${newHeight}px`;
                resizableBox.style.top = `${newTop}px`;
            }
        }
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        isResizing = false;
        currentResizer = null;
        resizableBox.style.cursor = 'grab';
    });

    // Initial render
    render();

    // --- Submission Logic ---
    const submitBtn = document.getElementById('submitBtn');
    const outputDiv = document.getElementById('output');

    submitBtn.addEventListener('click', () => {
        if (!userUploadedImage) {
            alert('Please upload an image first!');
            return;
        }

        // Hide elements that should not be in the final screenshot
        materialOverlay.style.display = 'none';
        resizers.forEach(resizer => resizer.style.display = 'none');

        html2canvas(cardPreview, {
            useCORS: true,
            allowTaint: true,
            backgroundColor: null
        }).then(canvas => {
            // Restore the hidden elements immediately after capture
            materialOverlay.style.display = 'block';
            resizers.forEach(resizer => resizer.style.display = 'block');

            const capturedImageDataUrl = canvas.toDataURL('image/png');
            const selectedMaterial = materialSelector.value;

            // --- Display the captured image and material for verification ---
            outputDiv.innerHTML = ''; // Clear previous output
            const title = document.createElement('h3');
            title.innerText = 'Final Design (for submission):';
            outputDiv.appendChild(title);

            const materialText = document.createElement('p');
            materialText.innerText = `Selected Material: ${selectedMaterial}`;
            outputDiv.appendChild(materialText);

            const finalImage = new Image();
            finalImage.src = capturedImageDataUrl;
            finalImage.style.width = '250px';
            finalImage.style.border = '1px solid #ccc';
            finalImage.style.marginTop = '10px';
            outputDiv.appendChild(finalImage);

            // --- How to send to server ---
            // const dataToSend = {
            //     finalImage: capturedImageDataUrl, // The base64 Data URL of the captured image
            //     material: selectedMaterial
            // };

            // fetch('/your-server-endpoint', {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json',
            //     },
            //     body: JSON.stringify(dataToSend),
            // })
            // .then(response => response.json())
            // .then(data => {
            //     console.log('Success:', data);
            //     alert('Your design has been submitted!');
            // })
            // .catch((error) => {
            //     console.error('Error:', error);
            //     alert('Something went wrong!');
            // });

        }).catch(err => {
            // Ensure elements are restored even if html2canvas fails
            materialOverlay.style.display = 'block';
            resizers.forEach(resizer => resizer.style.display = 'block');
            console.error('Error capturing the preview:', err);
            alert('Could not capture the design. Please try again.');
        });
    });
});