# Wassermelder app

The purpose of this app is to regularly take images of the current state of a water counter in Germany, and to track water consumption.

The app shall be a node.js app with a simple web frontend and a simple JSON file for data persistence. 

I am the sole user of the app, but I want to deploy it to render.com. 

## Features

1. in the web UI, you always see the following info:
   - duration of last time interval and consumption of water during that interval in Liters, and in Liters/day. The last time interval is the time between the last photo taken and the one before. 
   - Statistics that show the average of the whole year so far.
   - Simple table that shows the consumption in l/day in each month of the last year.
   - Graphical view of the consumption of the last year, with a week scale.

2. in the web UI, you can push a button and then the camera is activated to take a photo of the water counter. Then an LLM (cheap and reliable, you decide) analyzes the image to detect the current water consumption in m^3. Then the date + the counter is updating the JSON file, and the UI data are updated accordingly. The image is saved in folder images with file name photo_<date>.jpg

## Deployment and security.

I want to deploy the app to render.com, first publishing to github and then auto-deploying as web service. Find a good compromise between simplicity and security. This is an app with a public web page, but there are no important data in the app, there can be no financial damage from a hacker attack, so best implement a simple password mechanism. Do not add a user management, just a password to enter.

## Your task

Create the client web UI - simple but beautiful, and all required backend endpoints.

You may assume that an .env file is available that contains the key OPENAI_TOKEN / CLAUDE_TOKEN / DEEPSEEK_TOKEN / MISTRAL_TOKEN (according to your decision of llm) with the respective access token for this LLM.



