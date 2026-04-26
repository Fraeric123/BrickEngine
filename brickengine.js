
/* Imports */

import RAPIER from './libs/rapier.js';
import * as THREE from './libs/three.module.js';
import Stats from './libs/stats.module.js';
import { GLTFLoader } from './libs/GLTFLoader.js';
import { clone } from './libs/SkeletonUtils.js';
import { RGBELoader } from './libs/RGBELoader.js';
import GUI from './libs/lilgui.js';

import { ShaderPass } from './libs/postprocessing/ShaderPass.js';
import { EffectComposer } from './libs/postprocessing/EffectComposer.js';
import { RenderPass } from './libs/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './libs/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './libs/postprocessing/OutputPass.js';
import { BokehPass } from './libs/postprocessing/BokehPass.js';
import { GTAOPass } from './libs/postprocessing/GTAOPass.js';
import { SMAAPass } from './libs/postprocessing/SMAAPass.js';
import { OutlinePass } from './libs/postprocessing/OutlinePass.js';
import { TAARenderPass } from './libs/postprocessing/TAARenderPass.js';


/* Exports */

export class StudioUI {
    constructor(engine) {
        this.engine = engine;
        this.selectedInstance = null;
        this.isVisible = false;

        this.creatableClasses = ["BasePart", "Folder"];

        this._initDOM();
    }

    _initDOM() {
        this.container = document.createElement('div');
        this.container.id = 'studio-ui';
        Object.assign(this.container.style, {
            position: 'fixed', right: '0', top: '0', width: '300px', height: '100%',
            background: '#2b2b2b', color: '#cccccc', fontFamily: '"Segoe UI", Tahoma, sans-serif',
            fontSize: '13px', display: 'none', flexDirection: 'column', zIndex: '9999',
            borderLeft: '1px solid #111', userSelect: 'none'
        });

        const explorerHeader = document.createElement('div');
        explorerHeader.innerHTML = '<b>Explorer</b>';
        Object.assign(explorerHeader.style, { background: '#1e1e1e', padding: '5px 10px', borderBottom: '1px solid #111' });

        this.treeContainer = document.createElement('div');
        Object.assign(this.treeContainer.style, { flex: '1', overflowY: 'auto', padding: '5px' });

        const propsHeader = document.createElement('div');
        propsHeader.innerHTML = '<b>Properties</b>';
        Object.assign(propsHeader.style, { background: '#1e1e1e', padding: '5px 10px', borderBottom: '1px solid #111', borderTop: '1px solid #111' });

        this.propsContainer = document.createElement('div');
        Object.assign(this.propsContainer.style, { height: '40%', overflowY: 'auto', padding: '5px', display: 'flex', flexDirection: 'column', gap: '2px' });

        this.container.appendChild(explorerHeader);
        this.container.appendChild(this.treeContainer);
        this.container.appendChild(propsHeader);
        this.container.appendChild(this.propsContainer);
        document.body.appendChild(this.container);

        const style = document.createElement('style');
        style.innerHTML = `
            .studio-item { display: flex; align-items: center; padding: 3px 5px; cursor: pointer; border-radius: 3px; }
            .studio-item:hover { background: #3a3a3a; }
            .studio-item.selected { background: #0078d7; color: white; }
            .studio-icon { width: 16px; height: 16px; margin-right: 6px; }
            .studio-add-btn { margin-left: auto; width: 16px; height: 16px; background: #444; text-align: center; line-height: 14px; border-radius: 3px; display: none; }
            .studio-item:hover .studio-add-btn { display: block; }
            .studio-add-btn:hover { background: #666; }
            
            .prop-row { display: grid; grid-template-columns: 100px 1fr; border: 1px solid #333; margin-bottom: -1px; }
            .prop-name { background: #252525; padding: 3px 5px; border-right: 1px solid #333; overflow: hidden; text-overflow: ellipsis; }
            .prop-val { background: #1e1e1e; padding: 2px; display: flex; gap: 2px; }
            .prop-val input { width: 100%; background: transparent; border: none; color: #ccc; padding: 0 5px; font-family: monospace; }
            .prop-val input:focus { outline: 1px solid #0078d7; background: #2a2a2a; }
            .prop-vec-input { width: 30%; }
        `;
        document.head.appendChild(style);
    }

    toggle(force) {
        this.isVisible = force !== undefined ? force : !this.isVisible;
        this.container.style.display = this.isVisible ? 'flex' : 'none';
        if (this.isVisible) this.refreshExplorer();
    }

    refreshExplorer() {
        this.treeContainer.innerHTML = '';
        if (!this.engine.activeMap) return;
        this._buildTree(this.engine.activeMap, this.treeContainer, 0);
    }

    _buildTree(instance, parentElement, depth) {
        const itemDiv = document.createElement('div');
        itemDiv.className = `studio-item ${this.selectedInstance === instance ? 'selected' : ''}`;
        itemDiv.style.paddingLeft = `${depth * 15 + 5}px`;

        const icon = document.createElement('img');
        icon.className = 'studio-icon';
        icon.src = `./assets/icons/explorer/${instance.classname}.png`;
        icon.onerror = () => { icon.src = './assets/icons/explorer/Instance.png'; }; // Defaultní ikona

        const text = document.createElement('span');
        text.innerText = instance.name || instance.classname;

        const addBtn = document.createElement('div');
        addBtn.className = 'studio-add-btn';
        addBtn.innerText = '+';
        addBtn.onclick = (e) => {
            e.stopPropagation();
            const type = prompt(`Co přidat do ${text.innerText}?\nMožnosti: ${this.creatableClasses.join(', ')}`, "BasePart");
            if (type && this.creatableClasses.includes(type)) {
                // Najdeme třídu v globálním kontextu nebo přes modul (zde použijeme malý trik)
                const evalType = eval(type); // Pokud máš třídy exportované, musíme k nim mít přístup
                if (evalType) {
                    const newInst = new evalType(this.engine);
                    instance.addChild(newInst);
                    newInst.init();
                    this.refreshExplorer();
                }
            }
        };

        itemDiv.appendChild(icon);
        itemDiv.appendChild(text);
        if (instance.classname === 'Folder' || instance.classname === 'GameMap' || instance.classname === 'Workspace') {
            itemDiv.appendChild(addBtn);
        }

        itemDiv.onclick = (e) => {
            e.stopPropagation();
            this.selectInstance(instance);
            this.refreshExplorer(); // Re-render pro aktualizaci .selected třídy
        };

        parentElement.appendChild(itemDiv);

        // Rekurze pro potomky
        for (const child of instance.children) {
            this._buildTree(child, parentElement, depth + 1);
        }
    }

    selectInstance(instance) {
        this.selectedInstance = instance;
        this.renderProperties();

        if (this.engine.outlinePass) {
            if (instance && instance.object3D) {
                this.engine.outlinePass.selectedObjects = [instance.object3D];
                this.engine.outlinePass.enabled = true; // Ujistíme se, že je zapnutý
            } else {
                this.engine.outlinePass.selectedObjects = [];
            }
        }
    }

    renderProperties() {
        this.propsContainer.innerHTML = '';
        if (!this.selectedInstance || !this.selectedInstance.properties) return;

        const inst = this.selectedInstance;
        const props = inst.properties;

        for (const key in props) {
            const val = props[key];
            const row = document.createElement('div');
            row.className = 'prop-row';

            const nameDiv = document.createElement('div');
            nameDiv.className = 'prop-name';
            nameDiv.innerText = key;

            const valDiv = document.createElement('div');
            valDiv.className = 'prop-val';

            // ROZPOZNÁNÍ TYPU VLASTNOSTI
            if (val && val.isVector3) {
                // Vector3 (XYZ)
                ['x', 'y', 'z'].forEach(axis => {
                    const inp = document.createElement('input');
                    inp.type = 'number';
                    inp.value = val[axis].toFixed(2);
                    inp.className = 'prop-vec-input';
                    inp.onchange = () => this._updateProperty(inst, key, axis, parseFloat(inp.value));
                    valDiv.appendChild(inp);
                });
            } else if (val && val.isEuler) {
                // Euler / Rotation
                ['x', 'y', 'z'].forEach(axis => {
                    const inp = document.createElement('input');
                    inp.type = 'number';
                    // Zobrazení ve stupních pro uživatele
                    inp.value = (val[axis] * (180 / Math.PI)).toFixed(1);
                    inp.className = 'prop-vec-input';
                    inp.onchange = () => this._updateProperty(inst, key, axis, parseFloat(inp.value) * (Math.PI / 180));
                    valDiv.appendChild(inp);
                });
            } else if (key.toLowerCase().includes('color')) {
                // Barva
                const inp = document.createElement('input');
                inp.type = 'color';
                inp.value = '#' + val.toString(16).padStart(6, '0');
                inp.onchange = () => this._updateProperty(inst, key, null, parseInt(inp.value.replace('#', '0x')));
                valDiv.appendChild(inp);
            } else if (typeof val === 'boolean') {
                // Checkbox
                const inp = document.createElement('input');
                inp.type = 'checkbox';
                inp.checked = val;
                inp.onchange = () => this._updateProperty(inst, key, null, inp.checked);
                valDiv.appendChild(inp);
            } else {
                // Číslo nebo String
                const inp = document.createElement('input');
                inp.type = typeof val === 'number' ? 'number' : 'text';
                inp.value = val;
                inp.onchange = () => this._updateProperty(inst, key, null, typeof val === 'number' ? parseFloat(inp.value) : inp.value);
                valDiv.appendChild(inp);
            }

            row.appendChild(nameDiv);
            row.appendChild(valDiv);
            this.propsContainer.appendChild(row);
        }
    }

    _updateProperty(instance, key, subKey, newValue) {
        let finalValue = newValue;

        // Pokud upravujeme osu u Vector3 / Euler
        if (subKey) {
            const vec = instance.properties[key].clone();
            vec[subKey] = newValue;
            finalValue = vec;
        }

        // Zavoláme setter, pokud existuje (např. set_position, set_color)
        const setterName = `set_${key}`;
        if (typeof instance[setterName] === 'function') {
            if (finalValue.isVector3 || finalValue.isEuler) {
                instance[setterName](finalValue.x, finalValue.y, finalValue.z);
            } else {
                instance[setterName](finalValue);
            }
        } else if (typeof instance.set === 'function') {
            instance.set(key, finalValue);
        } else {
            instance.properties[key] = finalValue;
        }

        // Pokud to změnilo jméno, musíme překreslit Explorer
        if (key === 'name') this.refreshExplorer();
    }
}

export class Instance {
    constructor(engine, name) {
        this.engine = engine;
        this.name = name;
        this.classname = this.constructor.name;
        this.uuid = crypto.randomUUID();

        this.onAdded = () => { };
        this.onDestroyed = () => { };
        this.onUpdated = (dt) => { };

        this.parent = null;
        this.children = [];
    }

    sync_with_physics(_alpha) {
        for (const child of this.children) child.sync_with_physics?.(_alpha);
    }

    set(key, value) {
        if (this.properties && key in this.properties) {
            this.properties[key] = value;
            this._apply?.();
        } else {
            this[key] = value;
        }
        return this;
    }

    addChild(child) {
        if (!child) return;
        child.parent = this;
        this.children.push(child);
    }

    removeChild(child) {
        const i = this.children.indexOf(child);
        if (i !== -1) { child.parent = null; this.children.splice(i, 1); }
    }

    getChildren() { return this.children; }

    get_decendants() {
        let out = [];
        for (const c of this.children) { out.push(c); out = out.concat(c.get_decendants()); }
        return out;
    }

    findFirstChild(name) { return this.children.find(c => c.name === name); }

    find_first_child_of_class(t) { return this.children.find(c => c.classname === t) ?? null; }

    find_all_children_of_class(t) { return this.children.filter(c => c.classname === t); }

    find_all_decendants_of_class(t) { return this.get_decendants().filter(c => c.classname === t); }

    init() {
        this.onAdded();
        for (const child of this.children) {
            child.init();
        }
    }

    update(dt) {
        this.onUpdated(dt);
        for (const c of this.children) c.update?.(dt);
    }

    destroy() {
        this.onDestroyed();
        if (this.object3D) this.object3D.parent?.remove(this.object3D);
        if (this.rigidBody && this.engine.activeMap)
            this.engine.activeMap.world.removeRigidBody(this.rigidBody);
        for (const c of [...this.children]) c.destroy?.();
        this.children = [];
        this.parent = null;
    }
}

export class Material extends Instance {
    constructor(engine, name) {
        super(engine, name);
        this.properties = {
            roughness: 0.5, metalness: 0.5, transparent: false, opacity: 1.0,
            textures: { albedo: null, normal: null, roughness: null, metalness: null, ao: null, alpha: null },
            sounds: { impact: null, step: null, break: null, slide: null },
            uvScale: new THREE.Vector2(1, 1),
            uvOffset: new THREE.Vector2(0, 0)
        };

    }
}

export class Debris extends Instance {
    constructor(engine) {
        super(engine, "Debris");
        this._queue = []; // { instance, lifetime, elapsed }
    }

    add_with_lifetime(instance, parent, lifetime) {
        if (this.engine.activeMap) this.engine.activeMap.add_instance(instance, parent);
        this._queue.push({ instance, lifetime, elapsed: 0 });
        return instance;
    }

    update(dt) {
        for (let i = this._queue.length - 1; i >= 0; i--) {
            const item = this._queue[i];
            item.elapsed += dt;
            if (item.elapsed >= item.lifetime) {
                item.instance.destroy();
                this._queue.splice(i, 1);
            }
        }
    }
}

export class BasePart extends Instance {
    constructor(engine) {
        super(engine, "BasePart");

        this.properties = {
            size: new this.engine.THREE.Vector3(1, 1, 3),
            position: new this.engine.THREE.Vector3(0, 0, 0),
            rotation: new this.engine.THREE.Vector3(0, 0, 0),
            color: 0x00ff00,
            material: null,
            anchored: false,
            canCollide: true,
            castShadow: true,
            receiveShadow: true,
            transparency: 0,
            mass: 1.0
        };

        this.object3D = null;
        this.rigidBody = null;
        this.collider = null;

        this.onCollide = () => { };
    }

    init() {
        super.init();
        this._create3D();
        this._createPhysics();
    }

    _create3D() {
        const map = this.engine.activeMap; if (!map) return;
        const p = this.properties;
        const geo = new this.engine.THREE.BoxGeometry(p.size.x, p.size.y, p.size.z);
        this.materialDef = this.engine.get_material(p.material || "default");
        const mProps = this.materialDef.properties;
        const mat = new this.engine.THREE.MeshStandardMaterial({
            color: p.color,
            transparent: p.transparency > 0,
            opacity: 1 - p.transparency,
            roughness: mProps.roughness,
            metalness: mProps.metalness
        });
        if (mProps.textures && mProps.textures.albedo) {
            const tex = this.engine.get_texture(mProps.textures.albedo);
            if (tex) {
                const instanceTex = tex.clone();

                instanceTex.wrapS = instanceTex.wrapT = this.engine.THREE.RepeatWrapping;
                instanceTex.colorSpace = this.engine.THREE.SRGBColorSpace;

                if (mProps.uvScale) {
                    instanceTex.repeat.set(mProps.uvScale.x, mProps.uvScale.y);
                }
                if (mProps.uvOffset) {
                    instanceTex.offset.set(mProps.uvOffset.x, mProps.uvOffset.y);
                }

                instanceTex.needsUpdate = true;
                mat.map = instanceTex;
            }
        }
        this.object3D = new this.engine.THREE.Mesh(geo, mat);
        this.object3D.position.copy(p.position);
        this.object3D.rotation.copy(p.rotation instanceof this.engine.THREE.Euler
            ? p.rotation : new this.engine.THREE.Euler(p.rotation.x ?? 0, p.rotation.y ?? 0, p.rotation.z ?? 0));
        this.object3D.castShadow = p.castShadow;
        this.object3D.receiveShadow = p.receiveShadow;
        this.object3D.userData.instanceId = this.uuid;
        this.object3D.userData.instance = this;
        map.scene.add(this.object3D);
    }

    _createPhysics() {
        const map = this.engine.activeMap; if (!map) return;
        const p = this.properties;
        const euler = p.rotation instanceof this.engine.THREE.Euler
            ? p.rotation : new this.engine.THREE.Euler(p.rotation.x ?? 0, p.rotation.y ?? 0, p.rotation.z ?? 0);
        const q = new this.engine.THREE.Quaternion().setFromEuler(euler);

        const desc = p.anchored
            ? this.engine.rapier.RigidBodyDesc.fixed()
            : this.engine.rapier.RigidBodyDesc.dynamic();
        desc.setTranslation(p.position.x, p.position.y, p.position.z);
        desc.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
        if (!p.anchored) desc.setAdditionalMass(p.mass || 1.0);

        this.rigidBody = map.world.createRigidBody(desc);
        this.rigidBody.userData = { instance: this };

        if (p.canCollide) {
            const cd = this.engine.rapier.ColliderDesc.cuboid(p.size.x / 2, p.size.y / 2, p.size.z / 2);
            cd.setActiveEvents(this.engine.rapier.ActiveEvents.COLLISION_EVENTS);
            this.collider = map.world.createCollider(cd, this.rigidBody);
        }
    }

    sync_with_physics(_alpha) {
        if (this.rigidBody && this.object3D && !this.properties.anchored) {
            const t = this.rigidBody.translation();
            const r = this.rigidBody.rotation();
            this.object3D.position.set(t.x, t.y, t.z);
            this.object3D.quaternion.set(r.x, r.y, r.z, r.w);
        }
        for (const c of this.children) c.sync_with_physics?.(_alpha);
    }


    // property management

    set_name(name) {
        super.name = name;
        return this;
    }

    set_material(materialName) {
        const matDef = this.engine.get_material(materialName);
        if (!matDef) return this;

        this.properties.material = materialName;
        this.materialDef = matDef;

        if (this.object3D) {
            const p = this.properties;
            const textures = matDef.properties.textures;

            const mat = new this.engine.THREE.MeshStandardMaterial({
                color: p.color,
                transparent: p.transparency > 0,
                opacity: 1 - p.transparency,
                roughness: matDef.properties.roughness,
                metalness: matDef.properties.metalness
            });

            if (textures.albedo) mat.map = this.engine.get_texture(textures.albedo);
            if (textures.normal) mat.normalMap = this.engine.get_texture(textures.normal);
            if (textures.roughness) mat.roughnessMap = this.engine.get_texture(textures.roughness);
            if (textures.metalness) mat.metalnessMap = this.engine.get_texture(textures.metalness);
            if (textures.ao) mat.aoMap = this.engine.get_texture(textures.ao);

            this.object3D.material.dispose();
            this.object3D.material = mat;
        }

        return this;
    }

    set_size(x, y, z) {
        this.properties.size.set(x, y, z);
        if (this.object3D) {
            this.object3D.geometry.dispose();
            this.object3D.geometry = new this.engine.THREE.BoxGeometry(x, y, z);
        }
        if (this.collider && this.engine.activeMap) {
            this.engine.activeMap.world.removeCollider(this.collider, false);
            const cd = this.engine.rapier.ColliderDesc.cuboid(x / 2, y / 2, z / 2);
            cd.setActiveEvents(this.engine.rapier.ActiveEvents.COLLISION_EVENTS);
            this.collider = this.engine.activeMap.world.createCollider(cd, this.rigidBody);
        }
        return this;
    }

    set_position(x, y, z) {
        this.properties.position.set(x, y, z);
        if (this.object3D) this.object3D.position.set(x, y, z);
        if (this.rigidBody) this.rigidBody.setTranslation({ x, y, z }, true);
        return this;
    }

    set_rotation(x, y, z) {
        const e = new this.engine.THREE.Euler(x, y, z);
        this.properties.rotation = e;
        const q = new this.engine.THREE.Quaternion().setFromEuler(e);
        if (this.object3D) this.object3D.rotation.copy(e);
        if (this.rigidBody) this.rigidBody.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
        return this;
    }

    set_color(color) {
        this.properties.color = color;
        if (this.object3D) this.object3D.material.color.set(color);
        return this;
    }

    set_anchored(anchored) {
        this.properties.anchored = anchored;
        if (this.rigidBody) {
            this.rigidBody.setBodyType(anchored ? 1 : 0, true); // 1=Fixed, 0=Dynamic
        }
        return this;
    }

    set_transparency(t) {
        this.properties.transparency = t;
        if (this.object3D) {
            this.object3D.material.transparent = t > 0;
            this.object3D.material.opacity = 1 - t;
        }
        return this;
    }

    set_cast_shadow(v) {
        this.properties.castShadow = v;
        if (this.object3D) this.object3D.castShadow = v;
        return this;
    }

    // physics interactions

    apply_impulse(x, y, z) { if (this.rigidBody) this.rigidBody.applyImpulse({ x, y, z }, true); return this; }
    apply_force(x, y, z) { if (this.rigidBody) this.rigidBody.addForce({ x, y, z }, true); return this; }
    apply_angular_impulse(x, y, z) { if (this.rigidBody) this.rigidBody.applyTorqueImpulse({ x, y, z }, true); return this; }
    set_angular_velocity(x, y, z) { if (this.rigidBody) this.rigidBody.setAngvel({ x, y, z }, true); return this; }
    set_velocity(x, y, z) { if (this.rigidBody) this.rigidBody.setLinvel({ x, y, z }, true); return this; }

    get_position() {
        if (this.rigidBody) { const t = this.rigidBody.translation(); return new this.engine.THREE.Vector3(t.x, t.y, t.z); }
        return this.properties.position.clone();
    }

    get_rotation() {
        if (this.rigidBody) { const r = this.rigidBody.rotation(); return new this.engine.THREE.Euler().setFromQuaternion(new this.engine.THREE.Quaternion(r.x, r.y, r.z, r.w)); }
        return this.properties.rotation.clone();
    }

    get_angular_velocity() {
        if (this.rigidBody) { const v = this.rigidBody.angvel(); return new this.engine.THREE.Vector3(v.x, v.y, v.z); }
        return new this.engine.THREE.Vector3();
    }

    get_velocity() {
        if (this.rigidBody) { const v = this.rigidBody.linvel(); return new this.engine.THREE.Vector3(v.x, v.y, v.z); }
        return new this.engine.THREE.Vector3();
    }

    update(dt) {
        if (!this.engine.activeMap || !this.parent) return;
        this.onUpdated(dt);



        for (const c of this.children) c.update?.(dt);
    }

    destroy() {
        if (this.object3D) {
            this.engine.activeMap?.scene.remove(this.object3D);
            this.object3D.geometry?.dispose();
            this.object3D.material?.dispose();
            this.object3D = null;
        }
        if (this.rigidBody && this.engine.activeMap) {
            this.engine.activeMap.world.removeRigidBody(this.rigidBody);
            this.rigidBody = null;
        }
        this.onDestroyed();
        for (const c of [...this.children]) c.destroy?.();
        this.children = []; this.parent = null;
    }
}

export class Model extends Instance {
    constructor(engine) {
        super(engine, "Model");
    }

    update(dt) {
        if (!this.engine.activeMap || !this.parent) return;
        for (const child of this.children) {
            if (child.update) {
                child.update(dt);
            }
        }
    }
}

export class Folder extends Instance {
    constructor(engine) {
        super(engine, "Folder");
    }

    update(dt) {
        if (!this.engine.activeMap || !this.parent) return;
        for (const child of this.children) {
            if (child.update) {
                child.update(dt);
            }
        }
    }
}


export class InteractDetector extends Instance {
    constructor(engine) {
        super(engine, "InteractDetector");
        this.properties = { maxDistance: 5.0, prompt: 'Stiskni F pro interakci', enabled: true };
        this.onInteract = (_parent) => { };
        this._raycaster = new engine.THREE.Raycaster();
        this._isLooking = false;
    }

    update(_dt) {
        if (!this.properties.enabled || !this.parent?.object3D || !this.engine.activeMap) return;
        this._raycaster.setFromCamera({ x: 0, y: 0 }, this.engine.activeMap.camera);
        const hits = this._raycaster.intersectObject(this.parent.object3D, true);
        const prev = this._isLooking;
        this._isLooking = hits.length > 0 && hits[0].distance <= this.properties.maxDistance;

        if (this._isLooking && this.engine.input.interact) {
            this.engine.input.interact = false;
            this.onInteract(this.parent);
        }
    }

    is_looking() { return this._isLooking; }
}

export class Lighting extends Instance {
    constructor(engine) {
        super(engine, "Lighting");

        this.properties = {
            sunColor: 0xffffff,
            sunIntensity: 1.0,
            sunPosition: new this.engine.THREE.Vector3(50, 100, 50),
            ambientColor: 0xffffff,
            ambientIntensity: 0.2
        };

        this._sun = null;
        this._ambient = null;
    }

    init() {
        super.init();
        this._apply();
    }

    _apply() {
        const map = this.engine.activeMap;
        if (!map) return;
        const scene = map.scene;

        if (!this._sun) {
            this._sun = scene.getObjectByName("SunLight") || new this.engine.THREE.DirectionalLight();
            this._sun.name = "SunLight";
            this._sun.castShadow = true;
            this._sun.shadow.mapSize.width = this._sun.shadow.mapSize.height = 2048;
            this._sun.shadow.camera.near = 0.5;
            this._sun.shadow.camera.far = 500;
            this._sun.shadow.camera.left = this._sun.shadow.camera.bottom = -100;
            this._sun.shadow.camera.right = this._sun.shadow.camera.top = 100;

            if (!this._sun.parent) scene.add(this._sun);
        }

        this._sun.color.set(this.properties.sunColor);
        this._sun.intensity = this.properties.sunIntensity;
        this._sun.position.copy(this.properties.sunPosition);

        if (!this._ambient) {
            this._ambient = scene.getObjectByName("AmbientLight") || new this.engine.THREE.AmbientLight();
            this._ambient.name = "AmbientLight";
            if (!this._ambient.parent) scene.add(this._ambient);
        }

        this._ambient.color.set(this.properties.ambientColor);
        this._ambient.intensity = this.properties.ambientIntensity;
    }

    set(key, value) {
        if (key in this.properties) {
            this.properties[key] = value;
        }
        return this;
    }

    update(dt) {
        super.update(dt);
        this._apply();
    }
}

export class Sky extends Instance {
    constructor(engine) {
        super(engine, "Sky");

        this.properties = {
            hdri: null,
            exposure: 1.0
        };
    }

    _apply() {
        const map = this.engine.activeMap;
        if (!map) return;

        const hdriName = this.properties.hdri;
        if (hdriName) {
            const texture = this.engine.assets.hdris.get(hdriName);

            if (texture) {
                texture.mapping = this.engine.THREE.EquirectangularReflectionMapping;
                map.engine.renderer.toneMappingExposure = this.properties.exposure;

                map.scene.background = texture;
                map.scene.environment = texture;
            } else {
                console.warn(`Sky: HDRI "${hdriName}" not found in assets!`);
            }
        }
    }

    init() {
        super.init();
    }

    update(dt) {
        super.update(dt);
        this._apply();
    }
}

export class JSScript extends Instance {
    constructor(engine) {
        super(engine, "JSScript");
        this.properties = { enabled: true };
        this.script = null;
        this._ctx = null;
        this._obj = null;
    }

    init() {
        super.init();
        if (!this.properties.enabled || !this.script) return;
        this._ctx = { engine: this.engine, map: this.engine.activeMap, parent: this.parent, self: this, THREE: this.engine.THREE };
        if (typeof this.script === 'function') {
            this._obj = this.script(this._ctx) ?? {};
        } else {
            this._obj = this.script;
            this._obj.init?.(this._ctx);
        }
    }

    update(dt) {
        if (!this.properties.enabled || !this._obj) return;
        this._obj.update?.(this._ctx, dt);
    }
}

export class Workspace extends Instance {
    constructor(engine) {
        super(engine, "Workspace");
    }
}

export class GameMap extends Instance {
    constructor(engine, name) {
        super(engine, "GameMap");
        this.name = name;
        this.uuid = crypto.randomUUID();
        this.scene = new engine.THREE.Scene();
        this.camera = new engine.THREE.PerspectiveCamera(75, engine.width / engine.height, 0.1, 1000);
        this.raycaster = new engine.THREE.Raycaster();
        this.listener = new engine.THREE.AudioListener();
        this.camera.add(this.listener);
        this.world = new engine.rapier.World({ x: 0, y: -9.81, z: 0 });
        this.eventQueue = new engine.rapier.EventQueue();

        this.camera.rotation.order = 'YXZ';
        this.camera.position.set(0, 2, 8);
        this.camera.lookAt(0, 0, 0);

        this.camera_speed = 1;
        this.targetZoom = 1.0;
        this.zoomSmoothness = 0.1;
        this.defaultFOV = 75;
        this.targetFOV = 75;
        this.zoomLevel = 1.0;
        this.camera_mode = "free"; // "free" or "follow"
        this.cameraTarget = null;
        this.raycasting = false;
        this.raycastTimer = 0;
        this.raycastDelay = 0.1;

        this.debugEnabled = false;
        this.debugMesh = new engine.THREE.LineSegments(
            new engine.THREE.BufferGeometry(),
            new engine.THREE.LineBasicMaterial({ color: 0xff0000, vertexColors: false })
        );
        this.debugMesh.frustumCulled = false;
        this.scene.add(this.debugMesh);

        this.lighting = new Lighting(engine);
        this.workspace = new Workspace(engine);

        super.addChild(this.lighting);
        super.addChild(this.workspace);

        this.running = true;
    }


    // skybox functions

    set_hdri(name, exposure = 1.0) {
        const hdri = this.engine.get_hdri(name);
        if (!hdri) return;
        this.scene.background = hdri;
        this.scene.environment = hdri;
        this.engine.renderer.toneMappingExposure = exposure;
    }


    // property management

    set_camera_position(x, y, z) {
        this.camera.position.set(x, y, z);
    }

    add_instance(instance, parent = this.workspace) {
        if (!instance) return;
        parent.addChild(instance);
        instance.init();
        return instance;
    }

    add(instance) { return this.add_instance(instance, this.workspace); }


    // physics management

    handleCollision(h1, h2) {
        const col1 = this.world.getCollider(h1);
        const col2 = this.world.getCollider(h2);
        if (!col1 || !col2) return;

        const body1 = col1.parent();
        const body2 = col2.parent();
        const inst1 = body1?.userData?.instance;
        const inst2 = body2?.userData?.instance;
        if (!inst1 || !inst2) return;

        const v1 = body1.linvel();
        const v2 = body2.linvel();

        const impactForce = Math.sqrt(
            Math.pow(v1.x - v2.x, 2) +
            Math.pow(v1.y - v2.y, 2) +
            Math.pow(v1.z - v2.z, 2)
        );

        if (impactForce > 1.5) {
            [inst1, inst2].forEach(inst => {
                if (inst.materialDef && inst.materialDef.sounds.impact) {
                    const pos = inst.rigidBody.translation();

                    this.engine.play_sound_3d(inst.materialDef.sounds.impact, pos, {
                        volume: Math.min(impactForce * 0.1, 1.0),
                        refDistance: 2.0
                    });
                }
            });
        }

        if (inst1.onCollide) {
            inst1.onCollide(inst1, inst2, impactForce);
        }
        if (inst2.onCollide) {
            inst2.onCollide(inst2, inst1, impactForce);
        }
    }

    // lifecycle

    init() {
        for (const instance of this.children) {
            instance.init();
        }
    }

    render(alpha, renderDt) {
        if (this.engine.outlinePass) {
            const time = performance.now() * 0.007;
            const pulse = 4.0 + Math.sin(time) * 1.0;

            this.engine.outlinePass.edgeStrength = pulse;
            this.engine.outlinePass.edgeGlow = 0.5 + Math.sin(time) * 0.2;
            this.engine.outlinePass.edgeThickness = 1.0;
        }

        this.camera.rotation.y = this.engine.look.yaw;
        this.camera.rotation.x = this.engine.look.pitch;

        // if (!this.player) { this.player = this.get_first_instance_of_class(Player) }
        if (!this.player) { this.player = "no-player" }

        if (this.engine.engine_mode === "game" && this.player) {
            const player = this.player;
            if (player && player.rigidBody) {
                const pos = player.rigidBody.translation();

                let bobX = Math.cos(player.bobTime * 0.5) * 0.05 * player.bobIntensity;
                let bobY = Math.sin(player.bobTime) * 0.08 * player.bobIntensity;
                let bobZ = 0;

                const leanVisualOffset = player.leanOffset * 0.4;
                const yaw = this.engine.look.yaw;

                this.camera.position.set(
                    pos.x + bobX + (Math.cos(yaw) * leanVisualOffset),
                    pos.y + (player.currentVisualHeight * 0.5) + bobY,
                    pos.z + (Math.sin(yaw) * leanVisualOffset)
                );

                this.camera.rotation.z = player.leanOffset * 0.05;
            }
        } else {
            this.camera.rotation.z = 0;
            const baseSpeed = this.engine.input.sprint ? 20 : 10;
            const speed = baseSpeed * renderDt * this.camera_speed;

            const forward = new this.engine.THREE.Vector3(
                -Math.sin(this.camera.rotation.y),
                0,
                -Math.cos(this.camera.rotation.y)
            );
            const right = new this.engine.THREE.Vector3().crossVectors(forward, this.camera.up);

            if (this.engine.input.forward) this.camera.position.addScaledVector(forward, speed);
            if (this.engine.input.back) this.camera.position.addScaledVector(forward, -speed);
            if (this.engine.input.left) this.camera.position.addScaledVector(right, -speed);
            if (this.engine.input.right) this.camera.position.addScaledVector(right, speed);
            if (this.engine.input.up) this.camera.position.y += speed;
            if (this.engine.input.crouch) this.camera.position.y -= speed;
        }

        for (const instance of this.children) {
            instance.sync_with_physics(alpha);
        }

        this.scene.updateMatrixWorld(true);

        this.raycastTimer += renderDt;

        if (this.raycastTimer > this.raycastDelay && this.raycasting) {
            this.raycastTimer = 0;

            this.raycaster.setFromCamera(this.engine.look.locked ? { x: 0, y: 0 } : this.engine.mouse, this.camera);

            const targetableObjects = [];
            for (const instance of this.children) {
                if (instance.object3D) targetableObjects.push(instance.object3D);
            }

            const intersects = this.raycaster.intersectObjects(targetableObjects, true);

            if (intersects.length > 0) {
                let object = intersects[0].object;

                let rootObject = object;
                while (rootObject.parent && !rootObject.userData.instanceId) {
                    rootObject = rootObject.parent;
                }

                if (this.engine.outlinePass) {
                    this.engine.outlinePass.selectedObjects = [rootObject];
                }

                this.engine.canvas3D.style.cursor = 'pointer';
            } else {
                if (this.engine.outlinePass) {
                    this.engine.outlinePass.selectedObjects = [];
                }
                this.engine.canvas3D.style.cursor = 'default';
            }
        }

        if (Math.abs(this.camera.fov - this.targetFOV) > 0.1) {
            this.camera.fov = this.engine.THREE.MathUtils.lerp(this.camera.fov, this.targetFOV, 0.15);
            this.camera.updateProjectionMatrix();
        }

        if (this.debugEnabled) {
            const { vertices, colors } = this.world.debugRender();
            this.debugMesh.geometry.setAttribute('position', new this.engine.THREE.BufferAttribute(vertices, 3));
            this.debugMesh.geometry.setAttribute('color', new this.engine.THREE.BufferAttribute(colors, 4));
            this.debugMesh.visible = true;
        } else {
            this.debugMesh.visible = false;
        }
    }

    update(dt) {
        if (!this.running) return;

        if (this.cameraTarget) {
            this.camera.position.lerp(this.cameraTarget.position, 0.1);
        }

        if (this.engine.input.zoomHeld) {
            const baseZoomFOV = 20;
            if (this.engine.look.zoomDelta !== 0) {
                this.zoomLevel += this.engine.look.zoomDelta * 2.0;
                this.zoomLevel = this.engine.THREE.MathUtils.clamp(this.zoomLevel, 1.0, 10.0);
                this.engine.look.zoomDelta = 0;
            }

            this.targetFOV = baseZoomFOV / this.zoomLevel;
        } else {
            this.targetFOV = this.defaultFOV;
            this.zoomLevel = 1.0;
            this.engine.look.zoomDelta = 0;
        }
        this.world.step(this.eventQueue);

        this.eventQueue.drainCollisionEvents((handle1, handle2, started) => {
            if (started) {
                this.handleCollision(handle1, handle2);
            }
        });

        for (const instance of this.children) {
            instance.update(dt);
        }
    }

    destroy() {
        for (const instance of this.children) {
            instance.destroy();
        }
    }
}


export class BrickEngine {
    constructor() {
        //libs
        this.rapier = RAPIER;
        this.THREE = THREE;
        this.RGBELoader = RGBELoader;
        this.clone = clone; // clone from SkeletonUtils
        this.gui = new GUI();

        // loaders
        this.textureLoader = new THREE.TextureLoader();
        this.gltfLoader = new GLTFLoader();
        this.audioLoader = new THREE.AudioLoader();
        this.hdrLoader = new RGBELoader();

        // postprocessing
        this.ShaderPass = ShaderPass;
        this.EffectComposer = EffectComposer;
        this.RenderPass = RenderPass;
        this.UnrealBloomPass = UnrealBloomPass;
        this.OutputPass = OutputPass;
        this.BokehPass = BokehPass;
        this.GTAOPass = GTAOPass;
        this.SMAAPass = SMAAPass;
        this.OutlinePass = OutlinePass;
        this.TAARenderPass = TAARenderPass;

        // init settings
        this.display_mode = 'normal_canvas';

        // canvas variables
        this.canvas2D = null;
        this.ctx2D = null;
        this.canvas3D = null;

        this.studioUI = null;

        // render variables
        this.aspect = 16 / 9;
        this.renderWidth = 2560;
        this.renderHeight = 1440;
        this.fps = 0;
        this.resolutionScale = 1.0;
        this.postProcessEnabled = false;

        // main variables
        this.maps = new Map();
        this.activeMap = null;
        this.renderer = null;
        this.engine_mode = "game"; // "editor" or "game"
        this.mouse = new this.THREE.Vector2();

        // assets
        this.assets = {
            textures: new Map(),
            sounds: new Map(),
            models: new Map(),
            hdris: new Map(),
            materials: new Map()
        }

        this.loadingContainer = null;
        this.loadingBar = null;
        this.statusText = null;

        // stats init
        this.stats = new Stats();
        this.stats.showPanel(0);
        const statsDom = this.stats.dom;
        statsDom.style.position = 'fixed';
        statsDom.style.top = '0px';
        statsDom.style.left = '0px';
        statsDom.style.zIndex = '100000';
        statsDom.style.display = 'block';
        document.body.appendChild(statsDom);

        // event listeners
        window.addEventListener('resize', () => this.resize_canvas());
        window.addEventListener('click', () => {
            if (this.THREE.AudioContext.getContext().state === 'suspended') {
                console.log("Resuming audio context...");
                this.THREE.AudioContext.getContext().resume();
            }
        }, { once: true });

        window.addEventListener('mousedown', (e) => {
            if (e.button === 0) this.input.interact = true;
        });
        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.input.interact = false;
        });

        // input setup
        this.input = {
            forward: false,
            back: false,
            left: false,
            right: false,
            leanLeft: false,
            leanRight: false,
            sprint: false,
            up: false,
            crouch: false,
            zoomHeld: false
        };
        this.look = {
            yaw: 0, pitch: 0, sensitivity: 0.0022, locked: false, zoomDelta: 0
        };
        const setKey = (code, state) => {
            const keyMap = {
                'KeyW': 'forward',
                'KeyS': 'back',
                'KeyA': 'left',
                'KeyD': 'right',
                'KeyQ': 'leanLeft',
                'KeyE': 'leanRight',
                'ShiftLeft': 'sprint',
                'ShiftRight': 'sprint',
                'KeyC': 'zoomHeld',
                'Space': 'up',
                'ControlLeft': 'crouch',
                'ControlRight': 'crouch'
            };
            if (keyMap[code]) this.input[keyMap[code]] = state;
        };
        window.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === "w") {
                e.preventDefault();
            }
            if (e.ctrlKey && e.key === "s") {
                e.preventDefault();
            }
            if (e.ctrlKey && e.key === "a") {
                e.preventDefault();
            }
            if (e.ctrlKey && e.key === "d") {
                e.preventDefault();
            }
            if (e.code === 'F2') {
                e.preventDefault();
                if (this.activeMap) {
                    this.activeMap.debugEnabled = !this.activeMap.debugEnabled;
                }
            }
            if (e.code === 'F4') {
                e.preventDefault();
                this.engine_mode = this.engine_mode === "game" ? "editor" : "game";
                console.log("Režim změněn na:", this.engine_mode);

                if (this.engine_mode === "game") {
                    this.studioUI.toggle(false);
                    this.canvas2D.requestPointerLock();
                    if (this.outlinePass) this.outlinePass.selectedObjects = [];
                } else {
                    document.exitPointerLock();
                    this.studioUI.toggle(true);
                }
            }
            if (e.code === 'Space') {
                e.preventDefault();
            }
            setKey(e.code, true);
        });
        window.addEventListener('beforeunload', (e) => {
            // e.preventDefault();
        });
        window.addEventListener('keyup', (e) => setKey(e.code, false));
        window.addEventListener('wheel', (e) => {
            if (this.input.zoomHeld) {
                this.look.zoomDelta -= e.deltaY * 0.001;
            }
        }, { passive: true });
        document.addEventListener('mousemove', (e) => {
            if (!this.look.locked) {
                const rect = this.canvas2D.getBoundingClientRect();
                this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            } else {
                let sens = this.look.sensitivity;
                if (this.activeMap && this.activeMap.camera) {
                    sens *= (this.activeMap.camera.fov / 75);
                }

                this.look.yaw -= e.movementX * sens;
                this.look.pitch -= e.movementY * sens;

                this.look.pitch = this.THREE.MathUtils.clamp(
                    this.look.pitch, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01
                );
            }
        });

        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (this.isMobile) {
            //this.createMobileInterface();
        }
    }

    // canvas functions

    resize_canvas() {
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const windowAspect = windowWidth / windowHeight;
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);

        let width, height;

        if (windowAspect > this.aspect) {
            height = windowHeight;
            width = height * this.aspect;
        } else {
            width = windowWidth;
            height = width / this.aspect;
        }

        this.width = width;
        this.height = height;


        [this.canvas3D, this.canvas2D].forEach(canvas => {
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;

            canvas.width = Math.floor(width * this.dpr);
            canvas.height = Math.floor(height * this.dpr);
        });

        const scaleX = this.width / this.renderWidth;
        const scaleY = this.height / this.renderHeight;

        if (this.renderer) {
            this.renderer.setSize(this.width, this.height, false);
            this.renderer.setPixelRatio(this.dpr);
        }

        if (this.activeMap && this.activeMap.camera) {
            this.activeMap.camera.aspect = this.width / this.height;
            this.activeMap.camera.updateProjectionMatrix();
        }

        if (this.composer) {
            this.composer.setSize(this.width, this.height);
        }

        if (this.pixelPass) {
            this.pixelPass.uniforms["resolution"].value.set(
                this.width * this.dpr,
                this.height * this.dpr
            );
        }

        this.ctx2D.setTransform(
            this.dpr * scaleX, 0,
            0, this.dpr * scaleY,
            0, 0
        );
    }

    drawRect(x, y, w, h, style = "white", opacity = 1, rotation = 0) {
        this.ctx2D.save();
        this.ctx2D.translate(x, this.renderHeight - y);
        this.ctx2D.rotate(rotation * Math.PI / 180);
        this.ctx2D.globalAlpha = opacity;
        this.ctx2D.fillStyle = style;
        this.ctx2D.fillRect(-w / 2, -h / 2, w, h);
        this.ctx2D.restore();
    }

    drawImg(x, y, w, h, img, opacity = 1, rotation = 0) {
        if (!img) return;
        this.ctx2D.save();
        this.ctx2D.translate(x, this.renderHeight - y);
        this.ctx2D.rotate(rotation * Math.PI / 180);
        this.ctx2D.globalAlpha = opacity;
        this.ctx2D.drawImage(img, -w / 2, -h / 2, w, h);
        this.ctx2D.restore();
    }

    drawText(x, y, text, size = 30, style = "white", opacity = 1, rotation = 0) {
        this.ctx2D.save();
        this.ctx2D.translate(x, this.renderHeight - y);
        this.ctx2D.rotate(rotation * Math.PI / 180);
        this.ctx2D.globalAlpha = opacity;
        this.ctx2D.fillStyle = style;
        this.ctx2D.font = size + "px Arial";
        this.ctx2D.textAlign = "center";
        this.ctx2D.textBaseline = "middle";
        this.ctx2D.fillText(text, 0, 0);
        this.ctx2D.restore();
    }

    clear2D() {
        this.ctx2D.save();
        this.ctx2D.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx2D.clearRect(0, 0, this.canvas2D.width, this.canvas2D.height);
        this.ctx2D.restore();
    }

    fix_canvas(canvas, zIndex) {
        canvas.style.position = 'fixed';
        canvas.style.zIndex = zIndex;
        canvas.style.display = 'block';
        canvas.style.top = '50%';
        canvas.style.left = '50%';
        canvas.style.transform = 'translate(-50%, -50%)';
    }

    async setup_canvas() {
        if (this.display_mode === 'normal_canvas') {

            // canvas
            this.canvas2D = document.createElement('canvas');
            this.canvas3D = document.createElement('canvas');
            document.body.appendChild(this.canvas2D);
            document.body.appendChild(this.canvas3D);

            // ctx
            this.ctx2D = this.canvas2D.getContext('2d');

            // debug outlines
            // this.canvas3D.style.outline = '1px solid blue';
            // this.canvas2D.style.outline = '1px solid red';

            this.fix_canvas(this.canvas3D, 0);
            this.fix_canvas(this.canvas2D, 1);

            this.canvas3D.style.pointerEvents = 'none';
            this.canvas2D.style.pointerEvents = 'auto';

            this.canvas2D.addEventListener('click', async () => {
                if (this.isMobile) return;
                this.canvas2D.focus();
                // this.canvas3D.requestFullscreen().catch(() => { });

                if (this.THREE.AudioContext.getContext().state === 'suspended') {
                    await this.THREE.AudioContext.getContext().resume();
                }

                try {
                    await this.canvas2D.requestPointerLock({ unadjustedMovement: true });
                } catch {
                    try {
                        await this.canvas2D.requestPointerLock();
                    } catch (error) { }
                }
            });

            document.addEventListener('pointerlockchange', () => {
                if (this.isMobile) return;
                this.look.locked = document.pointerLockElement === this.canvas2D;
                console.log("Mouse locked:", this.look.locked);
            });

            // canvas resize
            this.resize_canvas();
        }
    }

    // world functions

    add_map(name, GameMapClass) {
        const map = new GameMapClass(this);
        this.maps.set(name, map);
        return map;
    }

    set_map(name) {
        const newMap = this.maps.get(name);
        if (!newMap) return;

        if (this.activeMap) {
            this.activeMap.destroy();
        }

        this.activeMap = newMap;

        this.activeMap.init?.();

        newMap.camera.aspect = this.width / this.height;
        newMap.camera.updateProjectionMatrix();
        this.update_post_process();
        return this;
    }

    addToWorkspace(instance) {
        this.workspace.addChild(instance);
    }

    render_ui() {
        this.drawText(75, this.renderHeight - 30, `FPS: ${this.fps}`, 30, "white", 1, 0);
    }

    async setup_render() {
        this.renderer = new this.THREE.WebGLRenderer({
            canvas: this.canvas3D,
            antialias: false
        });
        this.renderer.setSize(this.width, this.height, false);
        this.renderer.setPixelRatio(this.dpr);
        this.renderer.toneMapping = this.THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = this.THREE.PCFShadowMap;
        this.composer = new this.EffectComposer(this.renderer);
    }

    update_post_process() {
        if (!this.activeMap) return;

        this.composer.passes = [];

        // Main render
        const renderPass = new this.RenderPass(this.activeMap.scene, this.activeMap.camera);
        this.composer.addPass(renderPass);


        // GTAO Shadows
        this.gtaoPass = new this.GTAOPass(
            this.activeMap.scene,
            this.activeMap.camera,
            this.width,
            this.height
        );
        this.gtaoPass.enabled = false;
        this.gtaoPass.output = this.GTAOPass.OUTPUT.Default;
        this.gtaoPass.intensity = 1.0;
        this.gtaoPass.radius = 0.5;
        this.gtaoPass.distanceExponent = 1.5;
        this.gtaoPass.samples = 32;
        this.composer.addPass(this.gtaoPass);


        // TAA
        const taaPass = new this.TAARenderPass(this.activeMap.scene, this.activeMap.camera);
        taaPass.enabled = false;
        taaPass.unbiased = true;
        taaPass.sampleLevel = 2;
        this.composer.addPass(taaPass);


        // Outline
        this.outlinePass = new this.OutlinePass(
            new this.THREE.Vector2(this.width * this.dpr, this.height * this.dpr), // Přidáno * this.dpr
            this.activeMap.scene,
            this.activeMap.camera
        );
        this.outlinePass.enabled = false;
        this.outlinePass.edgeStrength = 3;
        this.outlinePass.edgeGlow = 1.2;
        this.outlinePass.edgeThickness = 1;
        this.outlinePass.visibleEdgeColor.set('#37ff00');
        this.outlinePass.hiddenEdgeColor.set('#000000');
        this.outlinePass.usePatternTexture = false;
        this.outlinePass.overlayMaterial.blending = this.THREE.AdditiveBlending;
        this.composer.addPass(this.outlinePass);


        // Bloom
        const bloomPass = new this.UnrealBloomPass(
            new this.THREE.Vector2(this.width, this.height),
            0.1, 0.1, 1
        );
        bloomPass.enabled = false;
        this.composer.addPass(bloomPass);
        this.activeMap.bokehPass = new this.BokehPass(this.activeMap.scene, this.activeMap.camera, {
            focus: 10.0,
            aperture: 0.001,
            maxblur: 0
        });
        this.composer.addPass(this.activeMap.bokehPass);


        // SMAA
        const smaaPass = new this.SMAAPass(this.width * this.dpr, this.height * this.dpr);
        smaaPass.enabled = false;
        this.composer.addPass(smaaPass);


        // BlackHole
        const BlackHoleShader = {
            uniforms: {
                "tDiffuse": { value: null },
                "time": { value: 0.0 },
                "resolution": { value: null },
                "cameraPos": { value: null },
                "cameraInverseViewProj": { value: null },
                "cameraViewProj": { value: null },
                "bhPos": { value: null },
                "bhRotation": { value: new this.THREE.Matrix4() },
                "bhMass": { value: 1.0 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform float time;
                uniform vec2 resolution;
                uniform vec3 cameraPos;
                uniform mat4 cameraInverseViewProj;
                uniform mat4 cameraViewProj;
                uniform vec3 bhPos;
                uniform float bhMass;
                uniform mat4 bhRotation;
                
                varying vec2 vUv;
                
                #define PI 3.14159265359

                float curve(float x) { return x * x * (3.0 - 2.0 * x); }
                float pcurve(float x){ float x2 = x * x; return 12.207 * x2 * x2 * (1.0 - x); }

                // Šum pro rozbití pruhování (banding) při raymarchingu
                float InterleavedGradientNoise(vec2 uv) {
                    vec3 magic = vec3(0.06711056, 0.00583715, 52.9829189);
                    return fract(magic.z * fract(dot(uv, magic.xy)));
                }

                float hash(vec3 p) {
                    p = fract(p * vec3(443.897, 441.423, 437.195));
                    p += dot(p, p.yzx + 19.19);
                    return fract((p.x + p.y) * p.z);
                }

                float Calculate3DNoise(vec3 p) {
                    vec3 i = floor(p);
                    vec3 f = fract(p);
                    f = f * f * (3.0 - 2.0 * f);
                    return mix(mix(mix(hash(i + vec3(0.0, 0.0, 0.0)), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
                                mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
                            mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
                                mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
                }

                float CalculateCloudFBM(vec3 position, vec3 shift){
                    float accum = 0.0;
                    float alpha = 0.5;
                    vec3 p = position;
                    for (int i = 0; i < 4; i++) {
                        accum += alpha * Calculate3DNoise(p);
                        p = (p + shift) * 2.5;
                        alpha *= 0.87;
                    }
                    return accum + (0.87 / 2.5) / 4.0;
                }

                vec3 Blackbody(float temp) {
                    vec3 color = vec3(255.0);
                    temp /= 100.0;
                    if (temp <= 66.0) {
                        color.r = 255.0;
                        color.g = clamp(99.4708025861 * log(temp) - 161.1195681661, 0.0, 255.0);
                        if (temp <= 19.0) color.b = 0.0;
                        else color.b = clamp(138.5177312231 * log(temp - 10.0) - 305.0447927307, 0.0, 255.0);
                    } else {
                        color.r = clamp(329.698727446 * pow(temp - 60.0, -0.1332047592), 0.0, 255.0);
                        color.g = clamp(288.1221695283 * pow(temp - 60.0, -0.0755148492), 0.0, 255.0);
                        color.b = 255.0;
                    }
                    return color / 255.0;
                }

                mat3 RotateMatrix(float x, float y, float z){
                    mat3 matx = mat3(1.0, 0.0, 0.0, 0.0, cos(x), sin(x), 0.0, -sin(x), cos(x));
                    mat3 maty = mat3(cos(y), 0.0, -sin(y), 0.0, 1.0, 0.0, sin(y), 0.0, cos(y));
                    mat3 matz = mat3(cos(z), sin(z), 0.0, -sin(z), cos(z), 0.0, 0.0, 0.0, 1.0);
                    return maty * matx * matz;
                }

                void WarpSpace(inout vec3 rayDir, vec3 rayPos, vec3 center){
                    vec3 diff = center - rayPos;
                    float dist2 = dot(diff, diff);
                    vec3 dirToCenter = normalize(diff);
                    // Zvýšením čísla 0.2 na vyšší (např. 0.5) posílíš efekt ohybu z dálky
                    float warpFactor = bhMass / (dist2 + 0.000001);
                    rayDir = normalize(rayDir + dirToCenter * warpFactor * 0.5); 
                }

                vec3 getRayDir(vec2 uv) {
                    vec4 ndc = vec4(uv * 2.0 - 1.0, 1.0, 1.0);
                    vec4 worldPos = cameraInverseViewProj * ndc;
                    worldPos.xyz /= worldPos.w;
                    return normalize(worldPos.xyz - cameraPos);
                }

                vec2 getScreenUV(vec3 dir) {
                    vec4 ndc = cameraViewProj * vec4(cameraPos + dir * 100.0, 1.0);
                    return (ndc.xy / ndc.w) * 0.5 + 0.5;
                }

                void main() {
                    vec3 rayDir = getRayDir(vUv);
                    vec3 rayPos = cameraPos;
                    vec3 center = bhPos;
                    
                    float transmittance = 1.0;
                    vec3 result = vec3(0.0);
                    
                    mat3 rotation = transpose(mat3(bhRotation));
                    
                    // Nastavení kroků přesně podle Minecraftu
                    const float steps = 70.0;
                    const float rSteps = 1.0 / steps;
                    const float stepLength = 0.5;

                    const float discRadius = 2.25;
                    const float discWidth = 3.5;
                    const float discInner = discRadius - discWidth * 0.5;

                    float distToCenter = length(center - cameraPos);
                    float influenceRadius = bhMass * 250.0;
                    
                    // Dithering šum zabrání vzniku ostrých kruhů (banding) při průchodu plynem
                    float dither = InterleavedGradientNoise(gl_FragCoord.xy);
                    
                    vec3 L = center - cameraPos;
                    if (dot(normalize(L), rayDir) > 0.0 || distToCenter < influenceRadius) {
                        
                        if (distToCenter > influenceRadius) {
                            rayPos += rayDir * (distToCenter - influenceRadius);
                        }

                        // Posunutí startu paprsku o šum
                        rayPos += rayDir * (stepLength * dither);

                        for(int i = 0; i < int(steps); i++){
                            if(transmittance < 0.0001) break;

                            WarpSpace(rayDir, rayPos, center);
                            rayPos += rayDir * stepLength;

                            vec3 localPos = rayPos - center;
                            vec3 discPos = rotation * localPos;

                            float r = length(discPos);
                            // Přesná náhrada za atan2 z MC 
                            float p = atan(-discPos.z, -discPos.x);
                            float h = discPos.y;

                            // Event horizon záchyt pro zrychlení a ostřejší jádro
                            if (length(localPos) < bhMass * 0.6) {
                                transmittance = 0.0;
                                break;
                            }

                            float radialGradient = 1.0 - clamp((r - discInner) / discWidth * 0.5, 0.0, 1.0);
                            float dist = abs(h);
                            float discThickness = 0.1 * radialGradient;

                            float fr = abs(r - discInner) + 0.4;
                            float fade = fr * fr * fr * fr * 0.04;
                            float bloomFactor = 1.0 / (h * h * 40.0 + fade + 0.00002);
                            bloomFactor *= clamp(2.0 - abs(dist) / discThickness, 0.0, 1.0);
                            bloomFactor = bloomFactor * bloomFactor;

                            float dr = pcurve(radialGradient);
                            float density = dr * clamp(1.0 - abs(dist) / discThickness, 0.0, 1.0);
                            density = clamp(density * 0.7, 0.0, 1.0);
                            density = clamp(density + bloomFactor * 0.1, 0.0, 1.0);

                            if (density > 0.0001){
                                vec3 discCoord = vec3(r, p * (1.0 - radialGradient * 0.5), h * 0.1) * 3.5;
                                float fbm = CalculateCloudFBM(discCoord, time * vec3(0.1, 0.07, 0.0));
                                
                                // Minecraft umocňuje FBM na 4. pro velmi detailní a kontrastní mračna
                                fbm = fbm * fbm;
                                fbm = fbm * fbm; 
                                density *= fbm * dr;

                                float gr = 1.0 - radialGradient;
                                float glowStrength = 1.0 / (gr * gr * gr * gr * 400.0 + 0.002);
                                vec3 glow = Blackbody(2700.0 + glowStrength * 50.0) * glowStrength;

                                // Dopplerův efekt (posuv k modré na jedné straně, k červené na druhé)
                                glow *= sin(p - 1.07) * 0.75 + 1.0;
                                
                                float stepTransmittance = exp2(-density * 7.0);
                                result += (1.0 - stepTransmittance) * transmittance * glow;
                                transmittance *= stepTransmittance;
                            }

                            // Vnitřní fotonový prstenec (přesný torus SDF)
                            float torusDist = length(vec2(length(discPos.xz) - 1.0, discPos.y + 0.05));
                            float bloomDisc = 1.0 / (pow(torusDist, 3.5) + 0.001);
                            vec3 col = Blackbody(12000.0);
                            bloomDisc *= step(0.5, r);

                            result += col * bloomDisc * 0.1 * transmittance;
                        }
                    }

                    result *= rSteps;
                    
                    vec2 bentUV = getScreenUV(rayDir);
                    bentUV = clamp(bentUV, 0.001, 0.999);
                    vec4 bgColor = texture2D(tDiffuse, bentUV);

                    // Pokud paprsek pohltila díra, pozadí bude černé
                    if (transmittance < 0.001) bgColor = vec4(0.0, 0.0, 0.0, 1.0);

                    gl_FragColor = vec4(bgColor.rgb * transmittance + result, 1.0);
                }
            `
        };
        this.blackHolePass = new this.ShaderPass(BlackHoleShader);
        this.blackHolePass.uniforms["resolution"].value = new this.THREE.Vector2(this.width * this.dpr, this.height * this.dpr);
        this.blackHolePass.uniforms["cameraPos"].value = new this.THREE.Vector3();
        this.blackHolePass.uniforms["bhPos"].value = new this.THREE.Vector3(0, 10, -20);
        this.blackHolePass.uniforms["cameraInverseViewProj"].value = new this.THREE.Matrix4();
        this.blackHolePass.uniforms["cameraViewProj"].value = new this.THREE.Matrix4();
        this.blackHolePass.enabled = false;
        this.composer.addPass(this.blackHolePass);


        // Pixel
        const PixelShader = {
            uniforms: {
                "tDiffuse": { value: null },
                "resolution": { value: new this.THREE.Vector2() },
                "pixelSize": { value: 3.0 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform vec2 resolution;
                uniform float pixelSize;
                varying vec2 vUv;
    
                void main() {
                    vec2 dxy = vec2(pixelSize * 1.5, pixelSize) / resolution;
                    vec2 coord = dxy * (floor(vUv / dxy) + 0.5);
                    gl_FragColor = texture2D(tDiffuse, coord);
                }
            `
        }
        this.pixelPass = new this.ShaderPass(PixelShader);
        this.pixelPass.uniforms["resolution"].value.set(this.width * this.dpr, this.height * this.dpr);
        this.pixelPass.uniforms["pixelSize"].value = 1.0;
        this.composer.addPass(this.pixelPass);
        this.pixelPass.enabled = false;


        // Final
        const outputPass = new this.OutputPass();
        this.composer.addPass(outputPass);

        if (this.gui) {
            const posteffectFolder = this.gui.addFolder('PostEffects');
            posteffectFolder.close();

            posteffectFolder.add(this, 'postProcessEnabled').name('Post-Process Enabled');

            const pixelFolder = posteffectFolder.addFolder('Pixel Effect');
            pixelFolder.add(this.pixelPass, 'enabled').name('Enabled');
            pixelFolder.add(this.pixelPass.uniforms["pixelSize"], 'value', 1, 60, 1).name('Pixel Size');
            pixelFolder.close();

            const bhFolder = posteffectFolder.addFolder('Black Hole Effect');
            bhFolder.add(this.blackHolePass, 'enabled').name('Enabled');
            bhFolder.add(this.blackHolePass.uniforms["bhMass"], 'value', 0.0, 5.0).name('Mass / Gravity');
            bhFolder.add(this.blackHolePass.uniforms["bhPos"].value, 'x', -100, 100).name('Position X');
            bhFolder.add(this.blackHolePass.uniforms["bhPos"].value, 'y', -50, 100).name('Position Y');
            bhFolder.add(this.blackHolePass.uniforms["bhPos"].value, 'z', -100, 100).name('Position Z');
            bhFolder.close();

            const bloomFolder = posteffectFolder.addFolder('Bloom');
            bloomFolder.add(bloomPass, 'enabled').name('Enabled');
            bloomFolder.add(bloomPass, 'strength', 0, 3);
            bloomFolder.add(bloomPass, 'radius', 0, 1);
            bloomFolder.add(bloomPass, 'threshold', 0, 1);
            bloomFolder.close();

            const gtaoFolder = posteffectFolder.addFolder('GTAO Shadows');
            gtaoFolder.add(this.gtaoPass, 'enabled').name('Enabled');
            gtaoFolder.add(this.gtaoPass, 'intensity', 0, 4).name('Intensity');
            gtaoFolder.add(this.gtaoPass, 'radius', 0, 5).name('Radius');
            gtaoFolder.add(this.gtaoPass, 'distanceExponent', 1, 4).name('Distance exponent');
            gtaoFolder.add(this.gtaoPass, 'samples', 8, 64, 1).name('Samples');
            gtaoFolder.close();

            const taaFolder = posteffectFolder.addFolder('TAA (Anti-aliasing)');
            taaFolder.add(taaPass, 'enabled').name('Enabled');
            taaFolder.add(taaPass, 'sampleLevel', {
                'Level 0 (Off)': 0,
                'Level 1': 1,
                'Level 2': 2,
                'Level 3': 3,
                'Level 4': 4,
                'Level 5': 5
            }).name('Sample Level');
            taaFolder.add(taaPass, 'unbiased').name('Unbiased Accumulation');
            taaFolder.close();

            const outlineFolder = posteffectFolder.addFolder('Outline');
            outlineFolder.add(this.outlinePass, 'enabled').name('Enabled');
            outlineFolder.add(this.outlinePass, 'edgeStrength', 0, 100);
            outlineFolder.add(this.outlinePass, 'edgeThickness', 0, 4);
            outlineFolder.add(this.outlinePass, 'edgeGlow', 0, 2);
            const params = {
                edgeColor: this.outlinePass.visibleEdgeColor.getHex()
            };
            outlineFolder.addColor(params, 'edgeColor')
                .name('Outline Color')
                .onChange((value) => {
                    this.outlinePass.visibleEdgeColor.set(value);
                });
            const params2 = {
                hedgeColor: this.outlinePass.hiddenEdgeColor.getHex()
            };
            outlineFolder.addColor(params2, 'hedgeColor')
                .name('hOutline Color')
                .onChange((value) => {
                    this.outlinePass.hiddenEdgeColor.set(value);
                });
            outlineFolder.close();
        }
    }


    // asset functions

    createLoadingUI() {
        this.loadingContainer = document.createElement('div');
        Object.assign(this.loadingContainer.style, {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '300px',
            zIndex: '10000',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px'
        });

        this.statusText = document.createElement('div');
        Object.assign(this.statusText.style, {
            color: 'white',
            fontFamily: 'monospace',
            fontSize: '10px',
            textTransform: 'lowercase',
            opacity: '0.8',
            width: '100%',
            textAlign: 'center',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
        });
        this.statusText.innerText = 'Inicialition...';

        const barWrapper = document.createElement('div');
        Object.assign(barWrapper.style, {
            width: '100%',
            height: '4px',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            background: 'rgba(0,0,0,0.8)',
            padding: '1px'
        });

        this.loadingBar = document.createElement('div');
        Object.assign(this.loadingBar.style, {
            width: '0%',
            height: '100%',
            background: 'white',
            transition: 'width 0.2s ease-out'
        });

        barWrapper.appendChild(this.loadingBar);
        this.loadingContainer.appendChild(this.statusText);
        this.loadingContainer.appendChild(barWrapper);
        document.body.appendChild(this.loadingContainer);
    }

    updateLoadingUI(percent, path) {
        if (this.loadingBar) {
            this.loadingBar.style.width = `${percent}%`;
        }
        if (this.statusText && path) {
            this.statusText.innerText = `Loading: ${path}`;
        }
    }

    removeLoadingUI() {
        if (this.loadingContainer && this.loadingContainer.parentNode) {
            this.loadingContainer.parentNode.removeChild(this.loadingContainer);
        }
    }

    add_texture(name, path) {
        this.assets.textures.set(name, path);
        return this
    }

    add_model(name, path) {
        this.assets.models.set(name, path);
        return this
    }

    add_hdri(name, url) {
        new RGBELoader().load(url, (texture) => {
            this.assets.hdris.set(name, texture);
            this.activeMap?.children.forEach(child => {
                if (child instanceof Sky) child._apply();
            });
        });
        return this;
    }

    add_sound(name, path) {
        this.assets.sounds.set(name, path);
        return this
    }

    add_material(material) {
        this.assets.materials.set(material.name, material);
        return this
    }

    get_number_of_textures() {
        return this.assets.textures.size;
    }

    get_number_of_models() {
        return this.assets.models.size;
    }

    get_number_of_hdris() {
        return this.assets.hdris.size;
    }

    get_number_of_sounds() {
        return this.assets.sounds.size;
    }

    get_texture(name) {
        return this.assets.textures.get(name);
    }

    get_model(name) {
        return this.assets.models.get(name);
    }

    get_hdri(name) {
        return this.assets.hdris.get(name);
    }

    get_sound(name) {
        return this.assets.sounds.get(name);
    }

    get_material(name) {
        if (name == "default") {
            return new Material();
        }
        return this.assets.materials.get(name) || this.get_material("default");
    }

    async load_assets() {
        this.createLoadingUI();
        const promises = [];
        let loadedCount = 0;

        const totalItems = this.get_number_of_textures() +
            this.get_number_of_models() +
            this.get_number_of_hdris() +
            this.get_number_of_sounds();

        if (totalItems === 0) {
            this.removeLoadingUI();
            return;
        }

        const onProgress = (path) => {
            loadedCount++;
            const percent = (loadedCount / totalItems) * 100;
            this.updateLoadingUI(percent, path);
        };

        for (const [name, path] of this.assets.textures) {
            console.log(`Loading texture: ${path}`);
            promises.push(new Promise((resolve, reject) => {
                this.textureLoader.load(path, (data) => {
                    this.assets.textures.set(name, data);
                    onProgress(path);
                    resolve();
                }, undefined, reject);
            }));
        }

        for (const [name, path] of this.assets.models) {
            console.log(`Loading model: ${path}`);
            promises.push(new Promise((resolve, reject) => {
                this.gltfLoader.load(path, (data) => {
                    this.assets.models.set(name, data);
                    onProgress(path);
                    resolve();
                }, undefined, reject);
            }));
        }

        for (const [name, path] of this.assets.hdris) {
            console.log(`Loading HDRI: ${path}`);
            promises.push(new Promise((resolve, reject) => {
                this.hdrLoader.load(path, (data) => {
                    data.mapping = this.THREE.EquirectangularReflectionMapping;
                    this.assets.hdris.set(name, data);
                    onProgress(path);
                    resolve();
                }, undefined, reject);
            }));
        }

        for (const [name, path] of this.assets.sounds) {
            console.log(`Loading sound: ${path}`);
            promises.push(new Promise((resolve, reject) => {
                this.audioLoader.load(path, (data) => {
                    this.assets.sounds.set(name, data);
                    onProgress(path);
                    resolve();
                }, undefined, reject);
            }));
        }

        await Promise.all(promises);

        this.updateLoadingUI(100, "");
        this.statusText.innerText = 'Complete!';
        await new Promise(r => setTimeout(r, 200));

        this.removeLoadingUI();
    }


    // sound management

    play_sound(name, options = {}) {
        const buffer = this.get_sound(name);
        if (!buffer || !this.activeMap) return null;

        const sound = new this.THREE.Audio(this.activeMap.listener);
        sound.setBuffer(buffer);
        sound.setLoop(options.loop ?? false);
        sound.setVolume(options.volume ?? 1.0);
        sound.play();

        if (!options.loop) {
            sound.source.onended = () => { sound.disconnect(); };
        }

        return sound;
    }

    play_sound_3d(name, position, options = {}) {
        const buffer = this.get_sound(name);
        if (!buffer || !this.activeMap) return null;

        const sound = new this.THREE.PositionalAudio(this.activeMap.listener);
        sound.setBuffer(buffer);
        sound.setRefDistance(options.refDistance ?? 1.0);
        sound.setMaxDistance(options.maxDistance ?? 100.0);
        sound.setLoop(options.loop ?? false);
        sound.setVolume(options.volume ?? 1.0);

        const audioLoaderObject = new this.THREE.Object3D();
        audioLoaderObject.position.set(position.x, position.y, position.z);
        this.activeMap.scene.add(audioLoaderObject);
        audioLoaderObject.add(sound);

        sound.play();

        if (!options.loop) {
            sound.source.onended = () => {
                sound.disconnect();
                this.activeMap.scene.remove(audioLoaderObject);
            };
        }

        return sound;
    }

    stop_sound(sound) {
        if (sound && sound.isPlaying) {
            sound.stop();
            sound.disconnect();
        }
    }


    // main functions

    async init({ display_mode }) {
        this.display_mode = display_mode;

        console.log("Initializing engine...");

        this.studioUI = new StudioUI(this);

        await this.setup_canvas();
        await this.load_assets();
        await this.setup_render();
        await this.rapier.init();
    }

    start() {
        this.lastTime = performance.now();
        this.fixedTimeStep = 1 / 60;
        this.accumulator = 0;

        const loop = (time) => {
            this.stats.begin();

            const renderDt = (time - this.lastTime) / 1000;
            const dt = Math.min(renderDt, 0.1);
            this.lastTime = time;

            this.accumulator += dt;
            this.fps = Math.round(this.fps * 0.9 + (1 / dt) * 0.1);

            while (this.accumulator >= this.fixedTimeStep) {

                // physics and game logic updates
                if (this.activeMap && this.activeMap.world) {
                    this.activeMap.update(this.fixedTimeStep);
                }

                this.accumulator -= this.fixedTimeStep;
            }

            const alpha = this.accumulator / this.fixedTimeStep;

            // render updates
            this.clear2D();
            this.render_ui();
            if (this.renderer && this.activeMap) {
                this.activeMap.render(alpha, renderDt);

                if (this.postProcessEnabled && this.composer) {
                    if (this.blackHolePass && this.blackHolePass.enabled && this.activeMap.camera) {
                        const cam = this.activeMap.camera;
                        this.blackHolePass.uniforms["time"].value = time / 1000;
                        this.blackHolePass.uniforms["cameraPos"].value.copy(cam.position);

                        cam.updateMatrixWorld();
                        const viewProj = new this.THREE.Matrix4();
                        viewProj.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);

                        this.blackHolePass.uniforms["cameraViewProj"].value.copy(viewProj);
                        this.blackHolePass.uniforms["cameraInverseViewProj"].value.copy(viewProj).invert();
                    }
                    this.composer.render();
                } else {
                    this.renderer.render(this.activeMap.scene, this.activeMap.camera);
                }
            }

            this.stats.end();

            requestAnimationFrame(loop);
        };

        requestAnimationFrame(loop);
    }
}