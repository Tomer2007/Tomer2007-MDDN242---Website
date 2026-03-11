# Tomer2007-MDDN242-Website
Day 1 Coding:
I first planned out the idea of the website with it being navigated kind of like an old school rpg games overworld with a moveable player character which needs to walk up to and interact with buttons on the website to get the content.

So first thing I added to the template is the ability to change the Buttons X margin while the websites running, first following the cursor, then being moved by having the arrow keys on the keyboard to slowly change it's location during the runtime.

AI was a big help in this part as real time adjustments controlled by keyboard inputs is something I'm not fully experienced with. It also unintentionally added some on screen buttons as it misinterpretted my request, however this actually came with the unintended benefit of making the website more accessible to mobile users so I kept iterating on it adding a action button as well so mobile users can open the menus.

I then had the AI give the button a BoundingBox so it could overlap some new boxes to test the User's character's interactions which currently just open an alert.

Next I quickly drew up some simple character pixel art and had the AI swap the code for the button for this new image, as well as getting the AI to make the image and the Bounding boxes size use a shared variable so I can easily edit it.

Next up I'm gonna get the AI to help me give the image animations (swapping between each Image with the same name but different number), and also make the image flip depending on which direction the user is moving.


WEBSITE RULES:
The set rules which the website is planned to be run by.

1. User can use both keyboard keys and on screen buttons to move the character around the screen.
2. User's view of the map and characters in the website's game world is limited to what they can view in the Tome-Boy border
3. The user can interact with the world when they input the action button while their character overlaps with an NPC's bounding box
4. User can freely scroll through the website to view the full map, however they will still be stopped by the world borders which will also block the player characters movement, so they can't go too far away from the actual map.
5. The player character are NPC's are bound to the size of a world border which will need to match the layout of the map sprite.
6. Although the user can look anywhere in bounds, inputting a button should smoothly reposition them with the player.
7. The player isn't static in the centre and can move freely inside the screen, only scrolling when they approach the edge.
8. On the side of the Tome-Boy their will be buttons on the page to teleport the character to the corresponding important NPC's.
7. The website will remember things like the players position, the users scroll, and any progress they might have made in quests and stuff (like the chicken gathering quest)
9. The player will start with three inputs, directional keys and buttons to move, and interact button (A button), and a sprint button (B button). They may later get other button by unlocking secrets in the website.
10. User's can click and drag things around the screen, matching the scroll.

Next I'm trying to add NPC's, so firstly, I got an AI to write some basic code to make some squares move around screen, occassionally stopping and idling. This worked pretty well quickly, so then asked AI to add the interaction between square and player which caused some issues.
Mainly there was an issue where the player wouldn't be able to interact the NPC's at all, then the problem where the player would only interact from certain angles, then the problems where the dialogue would appear too big or even behind the player.

Fortunately after a lot of debugging, I was able to solve all of these issues so the text will appear at the top left of the NPC, which can be interacted from any direction. I also made it freeze the NPC in place when being interacted with, forcing it to idle so it doesn't walk away when the player is talking to it.

Now I want to fix the onscreen buttons to be more in theme, so I'm going to get the AI to reposition them in a more standard controller layout based on image reference.
This has worked pretty well, but there are some problems when it comes to the mobile version, so I'm going to 

(still working on the read me so it's not fully updated)