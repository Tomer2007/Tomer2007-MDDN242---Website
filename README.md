# Tomer2007-MDDN242-Website

READ ME (The process of making Tomer's Website):

WEBSITE PLANNING:
I first planned out the idea of the website with it being navigated kind of like an old school rpg games overworld with a moveable player character which needs to walk up to and interact with buttons on the website to get the content.

INITIAL PROTOTYPE:
So first thing I added to the template is the ability to change the Buttons X margin while the websites running, first following the cursor, then being moved by having the arrow keys on the keyboard to slowly change it's location during the runtime.

Visual studios built in co-pilot was a big help in this part as real time adjustments controlled by keyboard inputs is something I'm not fully experienced with. 

I then had the AI give the button a BoundingBox so it could overlap some new boxes to test the User's character's interactions which currently just open an alert.

Image reference: "/Assets/MDDNP1-process/MDDNP1-process1"

Next I quickly drew up some simple character pixel art and had the AI swap the code for the button for this new image, as well as getting the AI to make the image and the Bounding boxes size use a shared variable so I can easily edit it.

Image reference: "/Assets/MDDNP1-process/MDDNP1-process2"

Next up I'm gonna get the AI to help me give the image animations (swapping between each Image with the same name but different number), and also make the image flip depending on which direction the user is moving.

MAKING A RULESET FOR THE AI:
To help the AI understand what I'm trying to do I gave it a list of rules I wanted the final website to operate by:

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

ADDING THE FIRST NPCS:
Next I'm trying to add NPC's, so firstly, I got an AI to write some basic code to make some squares move around screen, occassionally stopping and idling. This worked pretty well quickly, so then asked AI to add the interaction between square and player which caused some issues.
Mainly there was an issue where the player wouldn't be able to interact the NPC's at all, then the problem where the player would only interact from certain angles, then the problems where the dialogue would appear too big or even behind the player.

Fortunately after a lot of debugging, I was able to solve all of these issues so the text will appear at the top left of the NPC, which can be interacted from any direction. I also made it freeze the NPC in place when being interacted with, forcing it to idle so it doesn't walk away when the player is talking to it.

IMPROVING THE VISUAL DESIGN AND STYLE OF THE WEBSITE:
So next I wanted to make the website more stylised as currently I just had a simple pixel art style which played like a video game. So after some sketching I decided to style it off of a Game-Boy with working buttons on screen and a small window to see into the game's world.

ADDING THE ON-SCREEN BUTTONS:
So to do this I got co-pilot to make me some on screen buttons that correlate with the games inputs and then rearranged the buttons size and location to more closely resemble the buttons on a game-boy. (ButtonLayout.png was the reference at this point)

I then made a sprite of the controls and got co-pilot to adjust it to be over the buttons. I considered making the sprite have different states depending on which input is being pressed by decided against it for now as I first had to make the GameBoy the controls would go onto.

So I drew up a Game-Boy frame sprite and tried to make it stay in the same place on the website so it will always look like the game is being played on the GameBoy. However this came with a couple problems. 

CAMERA BUGS:
In my first attempt of this I tried to have the frame follow the player location, by asking Co-Pilot to make it move with the Players X and Y. However this came with many problems, especially when the website would be zoomed out, windowed, and worst of all opened on Mobile. After a lot of trouble shooting and trying to fix this I decided to just completely change my approach.

Image reference: "/Assets/MDDNP1-process/MDDNP1-process4"

FIXING THE CAMERA BUGS:
 My new idea was to instead have the GameBoy stay in a fixed position on the users viewpoint, letting them freely explore the world and making it stay consistent on different windows and by zooming in. This worked really well especially with when the player moves where once inputting a direction the camera automatically moves to the player. After fixing some stuttering bugs, where the player character would appear to always be pushed back abruptly whenever they would move off screen, later I made a space themed border around the game boy to hide the map so it can only be seen on the screen.

CREATING PLAYGROUND PAGE (MOBILE VERSION OF THE WEBSITE)
The other solution to this was for the mobile version, as this new concept initially didn't work on mobile as I couldn't find a way to make the mobile viewport follow the Gameboy sprite. So I decided to make the Mobile version use a completely different page for a "Demo" version without things like camera scrolling.
After getting co-pilot to move some of the code from the main website to this new one (leaving out the camera scrolling)
For this I didn't want to just make the current assets smaller so they would fit on one screen so I made completely new sprites for the Player and NPCs which was more in-line with an actual game-boys limitations, only having three different shades of green for colour and using much smaller sprites. I later even made a smaller version of the map cutting out all the unimportant buildings and making it in two colours, while still trying to keep things like the stone path and wooden floor boards texture.
I then made the main website check the users viewport height and width to determine if it's on a phone screen or not. Although this system might not work for all devices, I got it working at least on mine as it would take to long to find a way to perfectly predict if someones using any size of phone.

Image reference: "/Assets/MDDNP1-process/MDDNP1-process3"

MAKING THE WORLD MAP AND HITBOX:
After fixing the bugs on the computer version of the site, I quickly drew up a tile set for the world. By using the player sprite as reference I made some 32x32 pixel tiles and slowly by copying and pasting them individually (as the pixel art editor I was using didn't have built in tile set drawing function). The world map went through many variations, each one making the world bigger and adding new tiles that needed to be drawn. For reference I didn't delete any of these map sprites from the repository and they can all be seen in the Maps folder as well as the hitboxes (the second final world was a result of some small errors in the final world needing to be fixed). I then asked copilot to make a simple system which aligns the map and hitbox at a stationary point on the website which the player, and camera moves around in. I then also got copilot to write the basic collision code for the hitbox before tweaking it a bit as there where some problems with collision, like stopping NPCs from getting caught in walls when they spawn or when their interacted with (there is still a chance of slight clipping happening to the NPCs when they spawn to close to wall and start frantically turning). There even more problems with the hitboxes I had to fix when I added the next feature as well.

Image reference: "/Assets/MDDNP1-process/MDDNP1-process5"
And also you can see most of the versions of the map and tilesheet in the Assets/Maps folder

MAKING THE DRAGGING NPC FEATURE:
The picking up and dragging NPC feature, was something I initial had planned for as a way to let the player interact more in the world and to give them a fun side quest where they would grab chickens and put them back in their coop. To make this I asked co-pilot to code some basic pick up and dragging mechanics, and then further developed it with co-pilot to iron out all the bugs like making sure it scrolls the camera when the NPC is dragged of screen, making the dragging more fluid as the NPCs would tend to get caught on hitboxes or stop when the camera scrolled, and most absurdly stopping the NPC from softlocking the website by getting stuck to the cursor and forcing the camera to move far outside of the map. This also caused some problems with the walls so I had to work in some fixes by making sure the player couldn't just throw things into walls and get them stuck. This worked pretty well for all the walls, except the final interation of the sea where, if you drop an NPC too far past the wall of the deeper sea, they can get stuck unable to find the nearest clear tile, where they won't be able to move. If I get more time I might fix this bug, but for now I'm going to leave it as a feature, allowing the player to kick an NPC from the island if they don't like them.

CREATING GAME PROGRESSION (CHICKEN QUEST):
As for the chicken quest, I wanted it to feel like you actual progress by picking them up. So I got co-pilot to write some code for a CoopArea which the amount of chickens inside determine a chicken in coop variable which is saved locally, causing the same amount of chickens to appear in the coop when the page is reloaded while any chickens not in the area are randomly scattered.

FIXING THE MOBILE VERSION TO MAKE IT WORK ON ALL DEVICES:
After getting this working I went back to Mobile version to fix some issues. Firstly there were still some problems about the gameboy dissapearing on some devices due to everything apearing in an absolute position which can be unacessible on some devices, so to fix this I got co-pilot to make the make and gameboy reposition to centre on the viewport. After some tweaking to get them to line up, there was a new problem where now the NPCs and Player would only be on the map at certain resolutions. So I redid the map hitbox to stop characters from leaving the view of the screen, and I had their spawn positions be set in reference to the maps so they would also spawn in the same space no matter what size device their on.
Unfortunately, as the player and NPCs can freely move, trying to make these positions stay the same relative to the map is impossible, meaning if you try and resize the size of the viewport by inspecting the mobile website on a computer the NPCs and player will be pushed around by the hitbox. But since this won't be noticeable on the intended device for this site. I decided to leave this problem to fix later.
Next I also got copilot to change the dialogue system on the mobile site to use large pop up boxes instead of speech bubbles, as the original websites method would make the text unreadably small.

CREATING THE REUSABLE NPC SYSTEM:
While working on this, I also made a more easily recreatable system for NPCs on the main website, by getting co-pilot and claude to make a system that lets me set each NPCs location, sprites, text options, and even their ability to move with an easy set of variables which I would further adapt as more features were required. For example when I later added things like the dark mode setting, I decided to get co-pilot to make a new NPC type that doesn't speak and just changes a variable, acting like a switch, while still using the same interaction and animation logic as the NPCs.
There were also other things I got co-pilot to add as functions that could be run in the text to help with the Hall of Past Projects NPCs, letting me render images, put links, and change the texts size by writing simple commands in the NPCs dialogue options.

Image reference: "/Assets/MDDNP1-process/MDDNP1-process6"

CREATING AN AREA TO VIEW PAST PROJECTS:
Speaking of, after I got the hitbox for the starting house working I made the second building in the world, the Hall of Projects Past. This is the largest area, giving me lots of space to put more NPCs as I make more and more projects, for example I put in an NPC for my most recent project, Horse Empire. And then made a podium NPC to give a more detailed explanation of the projects using the "try" dialogue mode which was made later for the About, Contact, and News NPCs to show a lot of information in a large, scrollable pop up, which would be especially useful for the ever changing newsletter I wanted to make.

ADDING AN AREA FOR THE ABOUT ME, CONTACTS AND NEWSLETTER:
After I added the NPCs to the Hall I then added the rest of the required parts to the website like an About Me section, Contacts page, and also a newsletter I could update when I work on more projects. For this I knew the standard dialogue system wouldn't work as these sections will need to contain a lot more text, so I made them use a new pop up window based on the dialogue system from the Mobile page.

MAKING THE ACCESSIBILITY SETTINGS:
Now that I had all the important information on the page, I wanted to work on making it more accessible. Currently it was accessible on phones but it didn't account for things like user's who aren't fully experienced with playing video games, or who don't like all the moving parts, or who are trying to use the website without being blinded by the bright grass.
So for this I turned the right side room of the starting house into a settings room, getting co-pilot to make two variables which, when true, cause massive changes in the website. For example I added a lamp for the Light and Dark mode, which when true changes the map sprite to a darker one set at night, dims a lot of the websites elements, and even makes the chickens sleep.
The other variable was for Movement Reduction which was meant to zoom out the camera to give the player more space to move freely without having to see the entire screen scroll.
Unfortunately the movement reduction mode was as clean to implement as the Dark mode, requiring many variables to help tweak all the elements being zoomed out, especially for the "arena" area a secondary area outside the map which controls how far the camera can move. This mode would cause problems with large chunks of the map becoming unviewable as the cameras scroll would stop. This was even worse on other resolution moniters, which required a lot of bug fixing and versions.
Eventually the easiest solution I could find was to make the arena values very generous and just change the background from its solid purple colour to a repeating tile of the sea, which is a little confusing as the map clearly looks like it's just part of a larger island. But for now it does it's job well enough.

MAKING THE OUT OF SCREEN UI / A MORE ACCESSIBLE VERSION OF THE WEBSITE:
As for the websites accessibility for people not experienced with, or who just don't want to need to use the video game overworld gimmick, I made two new UI buttons to make the website more easy to navigate and get the info from.
Firstly I made a map button, using co-pilot to make an area based button around the maps sprite. Clicking this will pull up a crudely drawn map of the game's world with each named location having it's own button which teleports the player to that location.
The second UI element I added was a guide book which takes the user to a new page called guide_book which tells the user about the controls and mechanics in the site in a simple to understand book. However this still didn't address the people that didn't want to interact with the gimmicks, so I made the guide book a more diagetic object in the websites world, not just saying the controls but explaining a "walkthrough" of how to complete the NPC "quests". I chose to present the information in this round about way as I thought it was more immersive than just giving the information as straight text and helped add to the idea that the book was an actual videogame guide.
In the future, I want to try and make this guide even more immersive making it look more like a guide for the websites game and have it appear infront of the Gameboy instead of just taking the user to a different page. Also make the scrolling between pages more satisfying by having a button to change the text than have all the books floating above each other.

ADDING MUSIC:
After I finished the guide-books page aesthetics I chose to add some background music to both the main and mobile website to make it feel more like you were playing on a gameboy while music played from the speakers. For this I first found and downloaded a bunch of royalty free chiptune music, generally trying to split it into the more limited version for the mobile site to match it's visual limitations and more modern chiptune music for the more modern graphics of the main site. I then got co-pilot to make these songs play in a shuffled order with an ability to skip and pause the song when requested which I then made into the pause and skip button NPCs found in the left room. I also added a slider to adjust the volume which can be moved by dragging it.
Then when I went in to do the final updates to the mobile version I added the mobile music, with a pause and skip button to it.
With more time I might add a new list of music for the Guide Book page, which will use more chilled music most likely coming from some kind of new diagetic speaker, but for now it's just quiet.

MAKING THE MOBILE PAGE UP-TO-DATE:
To finish the Mobile version of the site I made some new sprites for the Ghost of Past Projects and added two new stationary NPCs, a guide who will also tell the user the About, Contact, and News NPC dialogue (not the best system but the house is too small to add three more NPCs in so for now the information requires repeating all the dialogue), and the Ghost of Projects past who will explain all the past projects with links to them.

FIXING NPC COLLISIONS AND CHICKEN QUEST:
After I had the Mobile version up to date, I went to fix some problems that came with the chicken collection quest and make an actual reward for collecting them all. The first of the bugs I had to fix was making sure the chickens couldn't leave the Coop, as there was a problem where once inside the chickens would just leave either by walking out of the coop area into the small gap before the wall or just clipping into the walls and being pushed to the other side. To fix this I had to change some of the ways the chickens worked making the chickens in the coop all spawn at the same central point, which meant I could increase the CoopArea without risk of chickens spawning in walls and being pushed outside the coop. I also fixed some more general NPC hit box interactions that where recurring. This bug would make the NPCs frantically spin around when they hit the top of a wall, stopping their movement. To fix this I had co-pilot replace this code with a simpler one which simply stops the NPC and makes them randomly turn and then move again after a short amount of time. This fixed a lot of the problems and made the website look a lot less like the NPC would flail around in panic as soon as they touched a wall.

GENERAL BUG FIXES / POLISH:
I then used the rest of my limited time on the project to fix some bugs and add Polish. For example, making the movement reduced mode centre on the player, removing the cropping of large sprites, tweaking and adding more NPC variations, fixing the player and npc spawning on both pages, fixing the drag and follow boundaries and much much more.

WRITING THE READ ME:
After I was satisfied with the state of the website I finished writing the Read Me, which I had unfortunately updated very little while working on the website meaning that large amounts of this read me were written a while after, meaning that some things may be a little out of order and might have their full development compartmentalized, like with the changes in the map, so I didn't have to bring up everytime I tweaked and developed each part (which happened a lot), most of which was me tweaking many aspects at the same time.

CONCLUSION:
In the end there is still a lot more stuff I would have wanted to add, and most likely will in the future like some actual in website minigames add more past projects to the hall and add an area for stuff in development, make a larger map with more things to do, and make some actual tangeble progression thats rewards users for interacting with all the elements.
This as well as many other smaller changes to the website to further polish it.

Fortunately, since I want to continue to use this website as a way to display my future works in a fun, interactable way I'll likely add this aspects later in my own time using the current website as a solid base for these changes.



ADDITIONAL NOTES AND LISTS LEFT OVER FROM DEVELOPMENT:
While working on this project I also made some lists and notes of things I planned to add, but since they didn't really flow well in the sequence of events I put them here.


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

This is just a fun easter egg so probably won't make it in.

In fact if I had infinite time to add more to this easter egg I would make an RPG style boss fight against the guide as well once all the other game elements are destroyed.

Also some minigames like a Rhythm game, a platformer, and maybe even a miniture version of the website, which contains a miniture version of the game which contains a miniture version of the game.





I also made a more urgent list for the things I wanted for submission a few days before it was due:

 - LIST OF REQUIREMENTS FOR SUBMISSION 

 - More NPCs (BurgerMan, Puppet, more NPCs)



 - CURRENT BUGS
 - NPC hitbox polish
 - Dialouge Text and images scale to device size (it's a feature)


- WORKING ON
- No noticeable bugs or errors (I don't think their will ever be absolutely no bugs)

- DONE
- Home Button + Clearer instructions
- Night mode which makes things darker
- Clearer instructions on how to navigate the website
- A basic website version with images and links.
- Clear instructions on how and what the basic website version does.
- Click to interact with NPCs (while stilling being able to drag)
- A guide NPC to help you navigate to places or something like a map outside the game which lets you press an option of where to go and get teleported there (can replace home button)
- Home Button
- About, Contact, Newsletter and Projects NPCs in mobile
- Music
 - Fully written Read Me
  - Fix the 2000 lines of spaghetti code to remove pointless variables and compress everything as much as possible without losing features. (I've tried to compress the code down, but with the amount of time I had, and how long the script.js is I might have missed some things)
