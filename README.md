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
This has worked pretty well, but there are some problems when it comes to the mobile version, with the screen looking way smaller and the controller being unaligned with the player. So to fix this I sent many more prompts trying to fix this, asking it to add all kinds of offsets and more.
Unfortunately non of these requests and changes would fix the problem without ruining the computer version so I decided to change my approach.
Firstly I made a prompt for the AI to change the controller positioning to be centred in the viewport, following the users scroll, and staying in the centre of the viewport even when it's resized.

I then asked the AI to make a copy of the all the current websites code to make the Playground Page, a lighter version of the website made for mobile without the mechanics that were harming the Mobile version. So to do this I asked the AI to remove the camera scroll and just have everything in one fixed screen.
To keep this looking good I changed all the sprite art, except the controller, making a smaller, less detailed, version of the map, NPCs, and player sprites inspired by the limitations of the Gameboy.

Unfortunately the NPCs dialogue box was too small in this version 

(still working on the read me so it's not fully updated)


To Do list (Ranked on how long term they will be added)

- Finish Adding and Spriting the NPC's in the Hall of Past Projects
- Add About Me buttons and Contact Info Buttons, Make Settings Room with things like Night Mode and Movement Reduction

- Add Nightmode: Change world Sprite Art for a night time look. Make chickens stop moving with Sleeping Sprite. Make Chicken Dialogue change to Zzzzzzz. Maybe give each NPC coffee like the coffee NPC? 
Mobile Nightmode will probably just dim the sprites inside the screen.

- Make new custom pixelated cursor whenever the player moves the cursor over the screen to show they can move NPCs, add drag sprites for each NPC, make the cursor react to being held down with a grabbing sprite, which remains as long as their dragging something (even if it goes off screen)

- Add music: find something chill and royalty free, get a chiptune song for mobile, and a cozier nighttime song.

-Add sound effects, give each NPC the Indie Rpg repeating audio for talking, with chickens getting the repeated sound of a chicken.

-Finish the Map adding the NPC housing North, Here their will be a couple buildings with NPCs as well as a mini game section in the centre and a art gallery at the top right to show art works.



-Add a home button in the constelattions which teleports player to spawn


-Add standard Website view button in constelattions which takes user to a new page with just text and images.
-Add quest progression, with the game remembering how many chickens are in the pen, and the Guide NPC reacting to the quests completion
-Expand the map to have a gallery for some art to the right, maybe make some houses up North
-Add decoration Npcs like Vases and Pots which when interacted with, break (zelda reference)
-Add more things to do in the Mobile Version


-Add the secret button in the Ominous Chapel
-Make the secret buttons change the maps sprite and hitbox, to show a secret room. Going in this room will let the player pick up the SWORD. This secret SWORD gives the player the new button input of X which will cause the character to stab in the direction it's facing. Hitting any scene elements with this (NPC's, Vases, More), will delete that page element with a pixelated explosion. They may be able to come back by reloading or may not.


- After killing all other NPCs the Player can now attack the guide who's shield wore off. Doing so will give some dialogue and then force the player into a new page. This page will function like a RPG boss battle. If the player tries to go back to the main website, they will automatically go back to the fight (as the code to send them there hasn't ended, make system similar to mobile check).
Upon defeating the Guide the player can return to the world which is empty. The background Music has stopped and the beaches sea is Red.
Going back to the underground Room the player can push a restart buttons to bring the website back to the way it was before.







 - LIST OF REQUIREMENTS FOR SUBMISSION

 - Home Button
 - No noticeable bugs or errors
 - Night mode which makes things darker
 - More NPCs (BurgerMan, Puppet, more NPCs)
 - About, Contact, Newsletter and Projects NPCs in mobile
 - Clearer instructions on how to navigate the website
 - A basic website version with images and links.
 - Clear instructions on how and what the basic website version does.
 - Fully written Read Me
 - Fix the goddamn 2000 lines of spaghetti code to remove pointless variables and compress everything as much as possible without losing features.

 - Click to interact with NPCs (while stilling being able to drag)
 - A guide NPC to help you navigate to places or something like a map outside the game which lets you press an option of where to go and get teleported there (can replace home button)



 - CURRENT BUGS
 - Arena size and position scales to device size.
 - Dialouge Text and images scale to device size
 - Two visible holes in map (Wall of halls)
 - NPC positioning issues