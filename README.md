# Tomer2007-MDDN242-Website
Day 1 Coding:
I first planned out the idea of the website with it being navigated kind of like an old school rpg games overworld with a moveable player character which needs to walk up to and interact with buttons on the website to get the content.

So first thing I added to the template is the ability to change the Buttons X margin while the websites running, first following the cursor, then being moved by having the arrow keys on the keyboard to slowly change it's location during the runtime.

AI was a big help in this part as real time adjustments controlled by keyboard inputs is something I'm not fully experienced with. It also unintentionally added some on screen buttons as it misinterpretted my request, however this actually came with the unintended benefit of making the website more accessible to mobile users so I kept iterating on it adding a action button as well so mobile users can open the menus.

I then had the AI give the button a BoundingBox so it could overlap some new boxes to test the User's character's interactions which currently just open an alert.

Next I quickly drew up some simple character pixel art and had the AI swap the code for the button for this new image, as well as getting the AI to make the image and the Bounding boxes size use a shared variable so I can easily edit it.

Next up I'm gonna get the AI to help me give the image animations (swapping between each Image with the same name but different number), and also make the image flip depending on which direction the user is moving.