// ==UserScript==
// @name         Cookie Garden Helper
// @namespace    https://github.com/marblenix/cookie-clicker
// @version      1.0
// @description  Automate your garden.
// @author       yannprada, hyoretsu, marblenix
// @homepage     https://github.com/marblenix/cookie-clicker
// @supportURL   https://github.com/marblenix/cookie-clicker/issues/new?title=%5BBug%5D+Garden-Helper
// @website      https://github.com/marblenix/cookie-clicker/tree/main/garden-helper
// @source       https://raw.githubusercontent.com/marblenix/cookie-clicker/main/garden-helper/garden-helper.user.js
// @updateURL    https://raw.githubusercontent.com/marblenix/cookie-clicker/main/garden-helper/garden-helper.user.js
// @icon         https://orteil.dashnet.org/cookieclicker/favicon.ico
// @match        https://orteil.dashnet.org/cookieclicker/
// @match        http://orteil.dashnet.org/cookieclicker/
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const moduleName = GM_info.script.name.replaceAll(" ", "");
  const capitalize = word => word.charAt(0).toUpperCase() + word.slice(1);
  const clone = x => JSON.parse(JSON.stringify(x));
  const doc = {
    elId: document.getElementById.bind(document),
    qSel: document.querySelector.bind(document),
    qSelAll: document.querySelectorAll.bind(document),
  };
  const defaultConfigs = {
    autoHarvest: false,
    autoHarvestAllMature: false,
    autoHarvestNewSeeds: true,
    autoHarvestAvoidImmortals: true,
    autoHarvestWeeds: true,
    autoHarvestCleanGarden: false,
    autoHarvestCheckCpSMult: false,
    autoHarvestMiniCpSMult: {
      value: 1,
      min: 0,
    },
    autoHarvestDying: true,
    autoHarvestDyingSeconds: 60,
    autoHarvestCheckCpSMultDying: false,
    autoHarvestMiniCpSMultDying: {
      value: 1,
      min: 0,
    },
    autoPlant: false,
    autoPlantCheckCpSMult: false,
    autoPlantMaxiCpSMult: {
      value: 0,
      min: 0,
    },
    savedPlot: [],
  };
  const configs = {};
  let changedConfigs = {};
  Object.assign(configs, defaultConfigs);

  const start = function () {
    class Garden {
      static
      get minigame() {
        return Game.Objects.Farm.minigame;
      }

      static
      get isActive() {
        return this.minigame !== undefined;
      }

      static
      get CpSMult() {
        let res = 1;
        // eslint-disable-next-line no-restricted-syntax
        for (const key in Game.buffs) {
          if (typeof Game.buffs[key].multCpS !== 'undefined') {
            res *= Game.buffs[key].multCpS;
          }
        }
        return res;
      }

      static
      get secondsBeforeNextTick() {
        return (this.minigame.nextStep - Date.now()) / 1000;
      }

      static hasHarvestBenefit(plant) {
        return typeof plant.onHarvest === 'function';
      }

      static
      get selectedSeed() {
        return this.minigame.seedSelected;
      }

      static
      set selectedSeed(seedId) {
        this.minigame.seedSelected = seedId;
      }

      static clonePlot() {
        const plot = clone(this.minigame.plot);
        for (let x = 0; x < 6; x++) {
          for (let y = 0; y < 6; y++) {
            // eslint-disable-next-line prefer-destructuring
            plot[x][y] = this.minigame.plot[x][y][0];

            const seedId = plot[x][y];
            if (this.getPlant(seedId) && !plant.plantable) {
              plot[x][y] = 0;
            }
          }
        }
        return plot;
      }

      static getPlant(id) {
        return this.minigame.plantsById[id - 1];
      }

      static getTile(x, y) {
        const tile = this.minigame.getTile(x, y);
        return {seedId: tile[0], age: tile[1]};
      }

      static getPlantStage(tile) {
        const plant = this.getPlant(tile.seedId);
        if (tile.age < plant.mature) {
          return 'young';
        }
        if (tile.age + Math.ceil(plant.ageTick + plant.ageTickR) < 100) {
          return 'mature';
        }
        return 'dying';
      }

      static tileIsEmpty(x, y) {
        return this.getTile(x, y).seedId === 0;
      }

      static plantSeed(seedId, x, y) {
        const plant = this.getPlant(seedId + 1);
        if (plant.plantable) {
          this.minigame.useTool(seedId, x, y);
        }
      }

      static forEachTile(callback) {
        for (let x = 0; x < 6; x++) {
          for (let y = 0; y < 6; y++) {
            if (this.minigame.isTileUnlocked(x, y)) {
              callback(x, y);
            }
          }
        }
      }

      static harvest(x, y) {
        this.minigame.harvest(x, y);
      }

      static fillGardenWithSelectedSeed() {
        if (this.selectedSeed > -1) {
          this.forEachTile((x, y) => {
            if (this.tileIsEmpty(x, y)) {
              this.plantSeed(this.selectedSeed, x, y);
            }
          });
        }
      }

      static handleYoung(config, plant, x, y) {
        if (!plant.unlocked && config.autoHarvestNewSeeds) {
          return;
        }

        if (plant.weed && config.autoHarvestWeeds) {
          this.harvest(x, y);
        }
        let seedId = config.savedPlot.length > 0 ? config.savedPlot[y][x] : [0, 0];
        seedId -= 1;
        if (
          config.autoHarvestCleanGarden &&
          ((plant.unlocked && seedId === -1) || (seedId > -1 && seedId !== plant.id)) &&
          plant.plantable
        ) {
          this.harvest(x, y);
        }
      }

      static handleMature(config, plant, x, y) {
        if (config.autoHarvestAllMature) {
          this.harvest(x, y);
        } else if (!plant.unlocked && config.autoHarvestNewSeeds) {
          this.harvest(x, y);
        } else if (
          config.autoHarvestCheckCpSMult &&
          this.hasHarvestBenefit(plant) &&
          this.CpSMult >= config.autoHarvestMiniCpSMult.value
        ) {
          this.harvest(x, y);
        }
      }

      static handleDying(config, plant, x, y) {
        if (config.autoHarvestAllMature) {
          this.harvest(x, y);
        } else if (config.autoHarvestCheckCpSMultDying && this.CpSMult >= config.autoHarvestMiniCpSMultDying.value) {
          this.harvest(x, y);
        } else if (config.autoHarvestDying && this.secondsBeforeNextTick <= config.autoHarvestDyingSeconds) {
          this.harvest(x, y);
        }
      }

      static run(config) {
        this.forEachTile((x, y) => {
          if (config.autoHarvest && !this.tileIsEmpty(x, y)) {
            const tile = this.getTile(x, y);
            const plant = this.getPlant(tile.seedId);

            if (plant.immortal && config.autoHarvestAvoidImmortals) {
              // do nothing
            } else {
              const stage = this.getPlantStage(tile);
              switch (stage) {
                case 'young':
                  this.handleYoung(config, plant, x, y);
                  break;
                case 'mature':
                  this.handleMature(config, plant, x, y);
                  break;
                case 'dying':
                  this.handleDying(config, plant, x, y);
                  break;
                default:
                  console.log(`Unexpected plant stage: ${stage}`);
              }
            }
          }

          if (
            config.autoPlant &&
            (!config.autoPlantCheckCpSMult || this.CpSMult <= config.autoPlantMaxiCpSMult.value) &&
            this.tileIsEmpty(x, y) &&
            config.savedPlot.length > 0
          ) {
            const seedId = config.savedPlot[y][x];
            if (seedId > 0) {
              this.plantSeed(seedId - 1, x, y);
            }
          }
        });
      }
    }

    class UI {
      static makeId(id) {
        return moduleName + capitalize(id);
      }

      static get css() {
        return `
          #game.onMenu #${moduleName} {
            display: none;
          }
          #${moduleName} {
            background: #000 url(img/darkNoise.jpg);
            display: none;
            padding: 1em;
            position: inherit;
          }
          #${moduleName}.visible {
            display: block;
          }
          #${moduleName}Tools:after {
            content: '';
            display: table;
            clear: both;
          }
          .${moduleName}Panel {
            float: left;
            width: 25%;
          }
          .${moduleName}BigPanel {
            float: left;
            width: 50%;
          }
          .${moduleName}SubPanel {
            float: left;
            width: 50%;
          }
          #autoHarvestPanel {
            color: #f5deb3;
          }
          #autoHarvestPanel a {
            color: #f5deb3;
          }
          #autoPlantPanel {
            color: #90ee90;
          }
          #autoPlantPanel a {
            color: #90ee90;
          }
          #autoHarvestPanel a:hover,
          #autoPlantPanel a:hover {
            color: #fff;
          }
          #${moduleName}Title {
            color: #808080;
            font-size: 2em;
            font-style: italic;
            margin-bottom: 0.5em;
            margin-top: -0.5em;
            text-align: center;
          }
          #${moduleName} h2 {
            font-size: 1.5em;
            line-height: 2em;
          }
          #${moduleName} h3 {
            color: #d3d3d3;
            font-style: italic;
            line-height: 2em;
          }
          #${moduleName} p {
            text-indent: 0;
          }
          #${moduleName} input[type='number'] {
            width: 3em;
          }
          #${moduleName} a.toggleBtn:not(.off) .toggleBtnOff,
          #${moduleName} a.toggleBtn.off .toggleBtnOn {
            display: none;
          }
          #${moduleName} span.labelWithState:not(.active) .labelStateActive,
          #${moduleName} span.labelWithState.active .labelStateNotActive {
            display: none;
          }
          #${moduleName}Tooltip {
            width: 300px;
          }
          #${moduleName}Tooltip .gardenTileRow {
            height: 48px;
          }
          #${moduleName}Tooltip .tile {
            border: 1px inset #696969;
            display: inline-block;
            height: 48px;
            width: 48px;
          }
          #${moduleName}Tooltip .gardenTileIcon {
            position: inherit;
          }
          #${moduleName} .warning {
            padding: 1em;
            font-size: 1.5em;
            background-color: #ffa500;
            color: #fff;
          }
          #${moduleName} .warning .closeWarning {
            font-weight: bold;
            float: right;
            font-size: 2em;
            line-height: 0.25em;
            cursor: pointer;
            transition: 0.3s;
          }
          #${moduleName} .warning .closeWarning:hover {
            color: #000;
          }
          `;
      }

      static numberInput(name, text, title, options) {
        const id = this.makeId(name);
        return `
          <input type="number" name="${name}" id="${id}" value="${options.value}" step=0.5
            ${options.min !== undefined ? `min="${options.min}"` : ''}
            ${options.max !== undefined ? `max="${options.max}"` : ''}
          />
          <label for="${id}" title="${title}">${text}</label>
          `;
      }

      static button(name, text, title, toggle, active) {
        if (toggle) {
          return `
            <a class="toggleBtn option ${active ? '' : 'off'}" name="${name}" id="${this.makeId(name)}" title="${title}">
              ${text}
              <span class="toggleBtnOn">ON</span>
              <span class="toggleBtnOff">OFF</span>
            </a>
            `;
        }
        return `<a class="btn option" name="${name}" id="${this.makeId(name)}" title="${title}">${text}</a>`;
      }

      static toggleButton(name) {
        const btn = doc.qSel(`#${moduleName} a.toggleBtn[name=${name}]`);
        btn.classList.toggle('off');
      }

      static labelWithState(name, text, textActive, active) {
        return `
          <span name="${name}" id="${this.makeId(name)}" class="labelWithState ${active ? 'active' : ''}"">
            <span class="labelStateActive">${textActive}</span>
            <span class="labelStateNotActive">${text}</span>
          </span>
          `;
      }

      static labelToggleState(name, active) {
        const label = doc.qSel(`#${moduleName} span.labelWithState[name=${name}]`);
        label.classList.toggle('active', active);
      }

      static createWarning(msg) {
        doc.elId('row2').insertAdjacentHTML(
          'beforebegin',
          `
            <div id="${moduleName}">
              <style>${this.css}</style>
              <div class="warning">
                <span class="closeWarning">&times;</span>
                ${msg}
              </div>
            </div>
            `,
        );
        doc.qSel(`#${moduleName} .closeWarning`).onclick = () => {
          doc.elId(moduleName).remove();
        };
      }

      static get readmeLink() {
        return 'https://github.com/yannprada/cookie-garden-helper/blob/master/README.md#how-it-works';
      }

      static build(config) {
        doc.qSel('#row2 .productButtons').insertAdjacentHTML(
          'beforeend',
          `
            <div id="${moduleName}ProductButton" class="productButton">
              Cookie Garden Helper
            </div>
            `,
        );
        doc.elId('row2').insertAdjacentHTML(
          'beforeend',
          `
            <div id="${moduleName}">
              <style>
                ${this.css}
              </style>
              <a href="${this.readmeLink}" target="new">how it works</a>
              <div id="${moduleName}Title" class="title">Cookie Garden Helper</div>
              <div id="${moduleName}Tools">
                <div class="${moduleName}BigPanel" id="autoHarvestPanel">
                  <h2>Auto-harvest ${this.button('autoHarvest', '', '', true, config.autoHarvest)}</h2>
                  <div class="${moduleName}SubPanel">
                    <h3>immortal</h3>
                    <p>
                      ${this.button(
                    'autoHarvestAvoidImmortals',
                    'Avoid immortals',
                    'Do not harvest immortal plants',
                    true,
                  config.autoHarvestAvoidImmortals,
                )}
                    </p>
                  </div>
                  <div class="${moduleName}SubPanel">
                    <h3>young</h3>
                    <p>
                      ${this.button(
                    'autoHarvestWeeds',
                    'Remove weeds',
                    'Remove weeds as soon as they appear',
                    true,
                  config.autoHarvestWeeds,
                )}
                    </p>
                    <p>
                      ${this.button(
                    'autoHarvestCleanGarden',
                    'Clean Garden',
                    'Only allow saved and new/unlocked seeds',
                    true,
                  config.autoHarvestCleanGarden,
                )}
                    </p>
                  </div>
                  <div class="${moduleName}SubPanel">
                    <h3>mature</h3>
                    <p>
                      ${this.button(
                    'autoHarvestNewSeeds',
                    'New seeds',
                    'Harvest new seeds as soon as they are mature',
                    true,
                  config.autoHarvestNewSeeds,
                )}
                    </p>
                    <p>
                      ${this.button(
                    'autoHarvestAllMature',
                    'All',
                    'Harvest all seeds as soon as they are mature',
                    true,
                  config.autoHarvestAllMature,
                )}
                    </p>
                    <p>
                      ${this.button(
                    'autoHarvestCheckCpSMult',
                    'Check CpS mult',
                    'Check the CpS multiplier before harvesting (see below)',
                    true,
                  config.autoHarvestCheckCpSMult,
                )}
                    </p>
                    <p>
                      ${this.numberInput(
                    'autoHarvestMiniCpSMult',
                    'Min CpS multiplier',
                    'Minimum CpS multiplier for the auto-harvest to happen',
                  config.autoHarvestMiniCpSMult,
                )}
                    </p>
                  </div>
                  <div class="${moduleName}SubPanel">
                    <h3>dying</h3>
                    <p>
                      ${this.button(
                    'autoHarvestDying',
                    'Dying plants',
                    `Harvest dying plants, ${config.autoHarvestDyingSeconds}s before the new tick occurs`,
                    true,
                  config.autoHarvestDying,
                )}
                    </p>
                    <p>
                      ${this.button(
                    'autoHarvestCheckCpSMultDying',
                    'Check CpS mult',
                    'Check the CpS multiplier before harvesting (see below)',
                    true,
                  config.autoHarvestCheckCpSMultDying,
                )}
                    </p>
                    <p>
                      ${this.numberInput(
                    'autoHarvestMiniCpSMultDying',
                    'Min CpS multiplier',
                    'Minimum CpS multiplier for the auto-harvest to happen',
                  config.autoHarvestMiniCpSMultDying,
                )}
                    </p>
                  </div>
                </div>
                <div class="${moduleName}Panel" id="autoPlantPanel">
                  <h2>Auto-plant ${this.button('autoPlant', '', '', true, config.autoPlant)}</h2>
                  <p>
                    ${this.button(
                    'autoPlantCheckCpSMult',
                    'Check CpS mult',
                    'Check the CpS multiplier before planting (see below)',
                    true,
                  config.autoPlantCheckCpSMult,
                )}
                  </p>
                  <p>
                    ${this.numberInput(
                    'autoPlantMaxiCpSMult',
                    'Max CpS multiplier',
                    'Maximum CpS multiplier for the auto-plant to happen',
                  config.autoPlantMaxiCpSMult,
                )}
                  </p>
                  <p>
                    ${this.button('savePlot', 'Save plot', 'Save the current plot; these seeds will be replanted later')}
                    ${this.labelWithState('plotIsSaved', 'No saved plot', 'Plot saved', Boolean(config.savedPlot.length))}
                  </p>
                </div>
                <div class="${moduleName}Panel" id="manualToolsPanel">
                  <h2>Manual tools</h2>
                  <p>
                    ${this.button(
                    'fillGardenWithSelectedSeed',
                    'Plant selected seed',
                    'Plant the selected seed on all empty tiles',
                )}
                  </p>
                </div>
              </div>
            </div>
            `,
        );

        doc.elId(`${moduleName}ProductButton`).onclick = () => {
          doc.elId(moduleName).classList.toggle('visible');
        };

        doc.qSelAll(`#${moduleName} input`).forEach(input => {
          input.onchange = () => {
            if (input.type === 'number') {
              const {min} = config[input.name];
              const {max} = config[input.name];
              if (min !== undefined && input.value < min) {
                input.value = min;
              }
              if (max !== undefined && input.value > max) {
                input.value = max;
              }
              Main.handleChange(input.name, input.value);
            }
          };
        });

        doc.qSelAll(`#${moduleName} a.toggleBtn`).forEach(a => {
          a.onclick = () => {
            Main.handleToggle(a.name);
          };
        });

        doc.qSelAll(`#${moduleName} a.btn`).forEach(a => {
          a.onclick = () => {
            Main.handleClick(a.name);
          };
        });

        doc.elId(`${moduleName}PlotIsSaved`).onmouseout = () => {
          Main.handleMouseoutPlotIsSaved(this);
        };
        doc.elId(`${moduleName}PlotIsSaved`).onmouseover = () => {
          Main.handleMouseoverPlotIsSaved(this);
        };
      }

      static getSeedIconY(seedId) {
        return Garden.getPlant(seedId).icon * -48;
      }

      static buildSavedPlot(savedPlot) {
        return `
          <div id="${moduleName}Tooltip">
            ${savedPlot.map(row => `
              <div class="gardenTileRow">
                ${row.map(tile => `
                  <div class="tile">
                    ${tile - 1 < 0 ? '' : `<div class="gardenTileIcon" style="background-position: 0 ${this.getSeedIconY(tile)}px;"></div>`}
                  </div>`,).join('')}
              </div>`,).join('')}
          </div>`;
      }
    }

    class Main {
      static init() {
        this.timerInterval = 1000;
        UI.build(configs);

        // sacrifice garden
        const oldConvert = Garden.minigame.convert;
        Garden.minigame.convert = () => {
          UI.labelToggleState('plotIsSaved', false);
          this.handleToggle('autoHarvest');
          this.handleToggle('autoPlant');
          Game.WriteSave();
          oldConvert();
        };

        this.start();
      }

      static start() {
        this.timerId = window.setInterval(() => Garden.run(configs), this.timerInterval);
      }

      static stop() {
        window.clearInterval(this.timerId);
      }

      static handleChange(key, value) {
        if (value === defaultConfigs[key].value) {
          delete changedConfigs[key];
          configs[key].value = defaultConfigs[key].value;
        } else {
          changedConfigs[key].value = value;
        }
        Game.WriteSave();
      }

      static handleToggle(key) {
        const newValue = !configs[key];
        console.log(key);
        console.log(configs[key]);
        console.log(newValue);
        console.log(defaultConfigs[key]);
        if (newValue === defaultConfigs[key]) {
          delete changedConfigs[key];
          configs[key] = defaultConfigs[key];
        } else {
          changedConfigs[key] = newValue;
        }
        Game.WriteSave();
        UI.toggleButton(key);
      }

      static handleClick(key) {
        if (key === 'fillGardenWithSelectedSeed') {
          Garden.fillGardenWithSelectedSeed();
        } else if (key === 'savePlot') {
          Object.assign(changedConfigs, {savedPlot: Garden.clonePlot()});
          UI.labelToggleState('plotIsSaved', true);
        }
        Game.WriteSave();
      }

      static handleMouseoutPlotIsSaved(element) {
        Game.tooltip.shouldHide = 1;
      }

      static handleMouseoverPlotIsSaved(element) {
        if (configs.savedPlot.length > 0) {
          const content = UI.buildSavedPlot(configs.savedPlot);
          Game.tooltip.draw(element, window.escape(content));
        }
      }
    }

    if (Garden.isActive) {
      Main.init();
    } else {
      const msg = "You don't have a garden yet. This mod won't work without it!";
      console.log(msg);
      UI.createWarning(msg);
    }
  }

  function init() {
    Game.registerMod(GM_info.script.name, {
      init: start,
      save: () => {
        Object.assign(configs, changedConfigs);
        return JSON.stringify(changedConfigs);
      },
      load: saveString => {
        changedConfigs = JSON.parse(saveString);
        Object.assign(configs, changedConfigs);
      },
    });
  }

  let interval;

  function checkGameState() {
    if (Game === undefined || !Game.ready) {
      return false
    } else {
      clearInterval(interval);
      init();
      return true;
    }
  }

  interval = setInterval(checkGameState, 1000);
})();
