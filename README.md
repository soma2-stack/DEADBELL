# Dead Bell - Multiplayer School Zombie Survival

A full-stack multiplayer 3D zombie survival game set in a classroom arena, built with **React**, **Three.js** (WebGL), **Tailwind CSS**, and **Express / WebSockets**. 

Experience tactical fast-paced survival inspired by classic arcade action and cooperative shooters. Survive infinite waves, buy weapons, clear gates, and coordinate with bot allies (or other players over LAN/Internet).

---

## 🚀 How to Export This Project to GitHub

You can export the entire up-to-date workspace directly to your GitHub account or download it as a ZIP right from Google AI Studio:

1. **Open the Settings Menu**: Look at the top-right corner or the sidebar of the **Google AI Studio** workspace.
2. **Export Option**: Click on **Export to GitHub** (or select **Download as ZIP**).
   - *If using Export to GitHub*: Authorize your GitHub account when prompted, choose to create a new repository (or push to an existing one), and type in your desired repository name (e.g., `dead-bell-zombies`).
   - *If using Download as ZIP*: Extract the ZIP file into a folder on your computer, initialize git inside it (`git init`), and push it manually to your own GitHub repository using standard Git commands.

---

## 🛠️ Local Installation & Running Guide

Once the code is on your computer or exported to your GitHub repo, follow these steps to play the game locally:

### 1. Prerequisites
Ensure you have **Node.js** (version 18 or newer) installed on your system. You can check your version in your terminal:
```bash
node -v
```

### 2. Download or Clone the Repository
Clone your exported project from GitHub:
```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME
```

### 3. Install Dependencies
Install all required client and server-side dependencies from `package.json`:
```bash
npm install
```

### 4. Setup Environment Variables
Create a local `.env` file at the root of the project by copying the example template:
```bash
cp .env.example .env
```
Open `.env` and fill in any optional configuration parameters (e.g., matching host URLs). The local gameplay functions perfectly without keys!

### 5. Start the Development Server
Run the unified Express and Vite dev server under a hot TypeScript runtime environment:
```bash
npm run dev
```
The console will output:
```text
Server running on http://localhost:3000
```
Open your web browser and navigate to **`http://localhost:3000`** to play.

---

## 🎮 How to Play

* **Movement**: `W`, `A`, `S`, `D` Keys
* **Sprint**: Hold `Left Shift` while moving
* **Aim Down Sights (ADS)**: Hold `Right-Click` for precise aiming and aligned iron sights
* **Shoot / Melee**: `Left-Click` (shoots current weapon or uses melee if out of ammo)
* **Reload**: Press `R` Key
* **Swap Weapons**: Press `Q` Key or use Scroll Wheel
* **Interact (Buy Ammo/Doors/Weapons)**: Press `E` Key when looking at walls/prompts
* **Jump**: Press `Spacebar`
* **Cursor Lock / Unlock**: Left-click the viewport to lock mouse cursor; press `ESC` to unlock and navigate settings

### ⚔️ Game Mechanics
* **Cash Rewards**: Earn money by landing hits ($10 Cash) and eliminating zombies ($60 for Body Kills, $100 for Headshot Kills).
* **Power-Ups**: Buy walls weapons (e.g., **Double-Barrel Shotgun** for $700) or refill ammunition ($350) to stay in the fight.
* **Unified Revive System**: In Co-op match settings, approach downed allies and hold your interact cursor over them to revive.
