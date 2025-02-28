const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Replace these with your Scratch and CubeUpload credentials
const scratchUsername = 'your_scratch_username';
const scratchPassword = 'your_scratch_password';
const cubeUploadUsername = 'your_cubeupload_username';
const cubeUploadPassword = 'your_cubeupload_password';

async function automate() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  // Step 1: Log in to Scratch
  await page.goto('https://scratch.mit.edu/login');
  
  // Wait for the login form to load
  await page.waitForSelector('#username');
  
  // Fill in username and password, then submit the form
  await page.type('#username', scratchUsername);
  await page.type('#password', scratchPassword);
  await page.click('button[type="submit"]');
  
  // Wait for successful login (checking if the user is redirected to their home page)
  await page.waitForNavigation();
  
  const loggedIn = await page.evaluate(() => {
    return document.querySelector('.avatar') !== null;
  });

  if (loggedIn) {
    console.log('Logged in successfully to Scratch!');
  } else {
    console.log('Login failed!');
    await browser.close();
    return;
  }

  // Step 2: Log in to CubeUpload
  await page.goto('https://cubeupload.com/');
  
  // Wait for the login form to load
  await page.waitForSelector('input[name="username"]');
  
  // Fill in CubeUpload username and password, then submit the form
  await page.type('input[name="username"]', cubeUploadUsername);
  await page.type('input[name="password"]', cubeUploadPassword);
  await page.click('button[type="submit"]');
  
  // Wait for navigation to confirm login success
  await page.waitForNavigation();
  
  const cubeUploadLoggedIn = await page.evaluate(() => {
    return document.querySelector('.upload-link') !== null; // Check if upload link is available (indicating successful login)
  });

  if (cubeUploadLoggedIn) {
    console.log('Logged in successfully to CubeUpload!');
  } else {
    console.log('CubeUpload login failed!');
    await browser.close();
    return;
  }

  // Step 3: Go to the last page of the Scratch discussion topic
  await page.goto('https://scratch.mit.edu/discuss/topic/744125/');
  
  // Wait for pagination controls to be visible
  await page.waitForSelector('.pagination');
  
  // Get the last page number
  const lastPageNumber = await page.evaluate(() => {
    const pages = document.querySelectorAll('.pagination .page-number');
    const lastPage = pages[pages.length - 1];
    return lastPage ? parseInt(lastPage.textContent.trim()) : 1;
  });

  console.log(`Navigating to the last page: ${lastPageNumber}`);

  // Navigate to the last page of the discussion
  await page.goto(`https://scratch.mit.edu/discuss/topic/744125/?page=${lastPageNumber}`);

  // Wait for the page to load and extract the last post's content
  await page.waitForSelector('.discussion-post');
  const lastPostLink = await page.evaluate(() => {
    const posts = document.querySelectorAll('.discussion-post');
    const lastPost = posts[posts.length - 1];
    const link = lastPost.querySelector('a');
    return link ? link.href : null;
  });

  if (lastPostLink) {
    // Go to the link in the last post
    await page.goto(lastPostLink);

    // Extract the image URL from the page
    const imageUrl = await page.evaluate(() => {
      const image = document.querySelector('img');
      return image ? image.src : null;
    });

    if (imageUrl) {
      // Download the image using Puppeteer
      const viewSource = await page.goto(imageUrl);
      const buffer = await viewSource.buffer();
      const imagePath = path.join(__dirname, 'downloaded_image.jpg');

      // Save the image locally
      fs.writeFileSync(imagePath, buffer);

      // Step 4: Upload the image to CubeUpload
      await page.goto('https://cubeupload.com/');
      await page.waitForSelector('input[type="file"]'); // Wait for file input

      const fileInput = await page.$('input[type="file"]');
      await fileInput.uploadFile(imagePath); // Upload the downloaded image

      // Wait for the upload to complete and get the image URL
      await page.waitForSelector('.upload-link'); // Wait for the link to be available
      const uploadedImageUrl = await page.evaluate(() => {
        const linkElement = document.querySelector('.upload-link');
        return linkElement ? linkElement.href : null;
      });

      if (uploadedImageUrl) {
        console.log(`Image uploaded: ${uploadedImageUrl}`);

        // Step 5: Go back to Scratch and quote the previous post
        await page.goto('https://scratch.mit.edu/discuss/topic/744125/?page=1');
        const quoteMessage = `Your image has been hosted: ${uploadedImageUrl}`;

        // Type the quote message in the textarea
        await page.waitForSelector('textarea');
        await page.type('textarea', quoteMessage);

        // Click the reply button
        await page.click('button[type="submit"]');
        console.log('Posted the message with the image link.');
      }
    }
  }

  await browser.close();
}

automate();
