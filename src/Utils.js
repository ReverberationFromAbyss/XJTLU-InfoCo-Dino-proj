import { loadTimeData } from 'chrome://resources/js/load_time_data.js';

import { CollisionBox } from './offline-sprite-definitions.js';

import { Runner } from './Runner.js';
import { GeneratedSoundFx } from './GeneratedSoundFx.js';
import { GameOverPanel } from './GameOverPanel.js';
import { Obstacles } from './Obstacle.js';
import { Trex } from './Trex.js';
import { DistanceMeter } from './DistanceMeter.js';
import { Cloud } from './Cloud.js';
import { BackgroundEl } from './BackgroundEl.js';
import { NightMode } from './NightMode.js';
import { HorizonLine } from './HorizonLine.js';
import { Horizon } from './Horizon.js';

/**
 * Default game width.
 * @const
 */
export const DEFAULT_WIDTH = 600;

/**
 * Frames per second.
 * @const
 */
export const FPS = 60;

/** @const */
export const IS_HIDPI = window.devicePixelRatio > 1;

/** @const */
export const IS_IOS = /CriOS/.test(window.navigator.userAgent);

/** @const */
export const IS_MOBILE = /Android/.test(window.navigator.userAgent) || IS_IOS;

/** @const */
export const IS_RTL = document.querySelector('html').dir == 'rtl';

/** @const */
export const ARCADE_MODE_URL = 'chrome://dino/';

/** @const */
export const RESOURCE_POSTFIX = 'offline-resources-';

/** @const */
export const A11Y_STRINGS = {
  ariaLabel: 'dinoGameA11yAriaLabel',
  description: 'dinoGameA11yDescription',
  gameOver: 'dinoGameA11yGameOver',
  highScore: 'dinoGameA11yHighScore',
  jump: 'dinoGameA11yJump',
  started: 'dinoGameA11yStartGame',
  speedLabel: 'dinoGameA11ySpeedToggle',
};

/**
 * Speak a phrase using Speech Synthesis API for a11y.
 * @param {string} phrase Sentence to speak.
 */
export function speakPhrase(phrase) {
  if ('speechSynthesis' in window) {
    const msg = new SpeechSynthesisUtterance(phrase);
    const voices = window.speechSynthesis.getVoices();
    msg.text = phrase;
    speechSynthesis.speak(msg);
  }
}

/**
 * For screen readers make an announcement to the live region.
 * @param {string} phrase Sentence to speak.
 */
export function announcePhrase(phrase) {
  if (Runner.a11yStatusEl) {
    Runner.a11yStatusEl.textContent = '';
    Runner.a11yStatusEl.textContent = phrase;
  }
}

/**
 * Returns a string from loadTimeData data object.
 * @param {string} stringName
 * @return {string}
 */
export function getA11yString(stringName) {
  return loadTimeData && loadTimeData.valueExists(stringName) ?
    loadTimeData.getString(stringName) :
    '';
}

/**
 * Get random number.
 * @param {number} min
 * @param {number} max
 */
export function getRandomNum(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Vibrate on mobile devices.
 * @param {number} duration Duration of the vibration in milliseconds.
 */
export function vibrate(duration) {
  if (IS_MOBILE && window.navigator.vibrate) {
    window.navigator.vibrate(duration);
  }
}

/**
 * Create canvas element.
 * @param {Element} container Element to append canvas to.
 * @param {number} width
 * @param {number} height
 * @param {string=} opt_classname
 * @return {HTMLCanvasElement}
 */
export function createCanvas(container, width, height, opt_classname) {
  const canvas =
      /** @type {!HTMLCanvasElement} */ (document.createElement('canvas'));
  canvas.className = opt_classname ? Runner.classes.CANVAS + ' ' +
    opt_classname : Runner.classes.CANVAS;
  canvas.width = width;
  canvas.height = height;
  container.appendChild(canvas);

  return canvas;
}

/**
 * Decodes the base 64 audio to ArrayBuffer used by Web Audio.
 * @param {string} base64String
 */
export function decodeBase64ToArrayBuffer(base64String) {
  const len = (base64String.length / 4) * 3;
  const str = atob(base64String);
  const arrayBuffer = new ArrayBuffer(len);
  const bytes = new Uint8Array(arrayBuffer);

  for (let i = 0; i < len; i++) {
    bytes[i] = str.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Return the current timestamp.
 * @return {number}
 */
export function getTimeStamp() {
  return IS_IOS ? new Date().getTime() : performance.now();
}


//******************************************************************************


//******************************************************************************

/**
 * Check for a collision.
 * @param {!Obstacle} obstacle
 * @param {!Trex} tRex T-rex object.
 * @param {CanvasRenderingContext2D=} opt_canvasCtx Optional canvas context for
 *    drawing collision boxes.
 * @return {Array<CollisionBox>|undefined}
 */
export function checkForCollision(obstacle, tRex, opt_canvasCtx) {
  const obstacleBoxXPos = Runner.defaultDimensions.WIDTH + obstacle.xPos;

  // Adjustments are made to the bounding box as there is a 1 pixel white
  // border around the t-rex and obstacles.
  const tRexBox = new CollisionBox(
    tRex.xPos + 1,
    tRex.yPos + 1,
    tRex.config.WIDTH - 2,
    tRex.config.HEIGHT - 2);

  const obstacleBox = new CollisionBox(
    obstacle.xPos + 1,
    obstacle.yPos + 1,
    obstacle.typeConfig.width * obstacle.size - 2,
    obstacle.typeConfig.height - 2);

  // Debug outer box
  if (opt_canvasCtx) {
    drawCollisionBoxes(opt_canvasCtx, tRexBox, obstacleBox);
  }

  // Simple outer bounds check.
  if (boxCompare(tRexBox, obstacleBox)) {
    const collisionBoxes = obstacle.collisionBoxes;
    let tRexCollisionBoxes = [];

    if (Runner.isAltGameModeEnabled()) {
      tRexCollisionBoxes = Runner.spriteDefinition.TREX.COLLISION_BOXES;
    } else {
      tRexCollisionBoxes = tRex.ducking ? Trex.collisionBoxes.DUCKING :
        Trex.collisionBoxes.RUNNING;
    }

    // Detailed axis aligned box check.
    for (let t = 0; t < tRexCollisionBoxes.length; t++) {
      for (let i = 0; i < collisionBoxes.length; i++) {
        // Adjust the box to actual positions.
        const adjTrexBox =
          createAdjustedCollisionBox(tRexCollisionBoxes[t], tRexBox);
        const adjObstacleBox =
          createAdjustedCollisionBox(collisionBoxes[i], obstacleBox);
        const crashed = boxCompare(adjTrexBox, adjObstacleBox);

        // Draw boxes for debug.
        if (opt_canvasCtx) {
          drawCollisionBoxes(opt_canvasCtx, adjTrexBox, adjObstacleBox);
        }

        if (crashed) {
          return [adjTrexBox, adjObstacleBox];
        }
      }
    }
  }
}


/**
 * Adjust the collision box.
 * @param {!CollisionBox} box The original box.
 * @param {!CollisionBox} adjustment Adjustment box.
 * @return {CollisionBox} The adjusted collision box object.
 */
export function createAdjustedCollisionBox(box, adjustment) {
  return new CollisionBox(
    box.x + adjustment.x,
    box.y + adjustment.y,
    box.width,
    box.height);
}


/**
 * Draw the collision boxes for debug.
 */
export function drawCollisionBoxes(canvasCtx, tRexBox, obstacleBox) {
  canvasCtx.save();
  canvasCtx.strokeStyle = '#f00';
  canvasCtx.strokeRect(tRexBox.x, tRexBox.y, tRexBox.width, tRexBox.height);

  canvasCtx.strokeStyle = '#0f0';
  canvasCtx.strokeRect(obstacleBox.x, obstacleBox.y,
    obstacleBox.width, obstacleBox.height);
  canvasCtx.restore();
}


/**
 * Compare two collision boxes for a collision.
 * @param {CollisionBox} tRexBox
 * @param {CollisionBox} obstacleBox
 * @return {boolean} Whether the boxes intersected.
 */
export function boxCompare(tRexBox, obstacleBox) {
  let crashed = false;
  const tRexBoxX = tRexBox.x;
  const tRexBoxY = tRexBox.y;

  const obstacleBoxX = obstacleBox.x;
  const obstacleBoxY = obstacleBox.y;

  // Axis-Aligned Bounding Box method.
  if (tRexBox.x < obstacleBoxX + obstacleBox.width &&
    tRexBox.x + tRexBox.width > obstacleBoxX &&
    tRexBox.y < obstacleBox.y + obstacleBox.height &&
    tRexBox.height + tRexBox.y > obstacleBox.y) {
    crashed = true;
  }

  return crashed;
}
