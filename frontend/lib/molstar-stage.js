// FIXME deal with bunch of ref things....
import { PluginContext } from "molstar/lib/mol-plugin/context";
import { StateTransforms } from "molstar/lib/mol-plugin-state/transforms";
import { MolScriptBuilder as MS } from "molstar/lib/mol-script/language/builder";
import { Mat4 } from "molstar/lib/mol-math/linear-algebra";
import { Color } from "molstar/lib/mol-util/color";

const DEFAULT_SPIN_SPEED = 0.05;

function parseHexColor(value, fallback = 0xffffff) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Color(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return Color(fallback);
    }
    const hex = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
    const parsed = Number.parseInt(hex, 16);
    if (Number.isFinite(parsed)) {
      return Color(parsed);
    }
  }
  return Color(fallback);
}

export class MolstarStage {
  constructor(container, params = {}) {
    this.container = container;
    this.params = params;
    this.plugin = null;
    this.canvas = null;
    this.spinSpeed = DEFAULT_SPIN_SPEED;
    this.clickFocus = null
  }

  async init() {
    if (!this.container) return;
    this.plugin = new PluginContext({
      actions: [],
      behaviors: [],
      animations: [],
      config: [],
    });
    await this.plugin.init();

    if (this.canvas && this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
    this.canvas = document.createElement("canvas");
    this.canvas.setAttribute("aria-hidden", "true");
    this.container.appendChild(this.canvas);

    const ok = await this.plugin.initViewerAsync(this.canvas, this.container);
    if (ok === false) {
      throw new Error("Mol* viewer initialization failed");
    }

    this.plugin.canvas3d?.setProps({
      transparentBackground: true,
      sceneRadiusFactor: 3.0,
      camera: {
        helper: { axes: { name: "off", params: {} } },
        fov: 60,
      },
      cameraClipping: {
        radius: 0,
        far: false,
        minNear: -1000,
      },
      // illumination: {
      //   shadowSoftness: 0,
      // },
      postprocessing: {
        outline: {
          name: 'on',
          params: {
            scale: 0.5,
            threshold: 0.3,
          },
        },
        // occlusion: {
        //   name: 'on',
        //   params: {
        //     samples: 128,
        //     multiScale: {
        //       name: 'on',
        //       params: {
        //         levels: [
        //           {
        //             radius: 5.0, bias: 1.5,
        //           },
        //         ],
        //         nearThreshold: 0,
        //         farThreshold: 10000,
        //       }
        //     },
        //     radius: 5.0,
        //     bias: 1.2,
        //     blurKernelSize: 3,
        //     blurDepthBias: 0.7,
        //     resolutionScale: 1.0,
        //     color: Color(0x262626),
        //     transparentThreshold: 0.4,
        //   }
        // }
      }
    });

    if (this.params.backgroundColor) {
      this.setBackground(this.params.backgroundColor);
    }

    this.plugin.canvas3d?.handleResize();
    this.clickFocus = this.onClick(e => {
      if (e.current?.loci?.kind !== 'element-loci') return
      console.log(e.current.loci)
      this.focusLoci(e.current.loci, 200, 15, 5)
    })
  }

  async clear() {
    if (!this.plugin) return;
    await this.plugin.clear();
  }

  async waitDraw() {
    this.plugin.canvas3d.requestDraw()
    await new Promise(resolve => requestAnimationFrame(resolve));
  }

  async loadStructure({ data, format, label }) {
    if (!this.plugin) return null;
    const raw = await this.plugin.builders.data.rawData(
      { data, label },
      { state: { isGhost: true } },
    );
    // console.log(raw)
    const trajectory = await this.plugin.builders.structure.parseTrajectory(
      raw,
      format,
    );
    const model = await this.plugin.builders.structure.createModel(trajectory);
    return this.plugin.builders.structure.createStructure(model);
  }

  async createComponentFromExpression(structure, expression, key) {
    if (!this.plugin || !structure || !expression) return null;
    return this.plugin.builders.structure.tryCreateComponentFromExpression(
      structure,
      expression,
      key,
    );
  }

  async createComponentStatic(structure, type = "all") {
    if (!this.plugin || !structure) return null;
    return this.plugin.builders.structure.tryCreateComponentStatic(
      structure,
      type,
    );
  }

  async addRepresentation(component, props, options) {
    if (!this.plugin || !component) return null;
    return this.plugin.builders.structure.representation.addRepresentation(
      component,
      props,
      options,
    );
  }

  async removeAllComponents() {
    if (!this.plugin) return null;
    const state = this.plugin.state.data;
    const update = state.build();
    const children = state.tree.children.get(state.tree.root.ref);
    children.forEach((ref) => {
      update.delete(ref);
    });
    await update.commit();
  }

  async clearOverpaintWithTag(ref, tag) {
    if (!this.plugin || !tag) return null;

    ref = typeof ref === "string" ? ref : ref.ref;
    const nodesToDelete = this.plugin.state.data.selectQ((q) =>
      q.byRef(ref).subtree().withTag(tag),
    );
    const update = this.plugin.state.data.build();
    update.delete(nodesToDelete[0].transform.ref);
    await update.commit();
  }

  async addOverpaintLayersWithTag(ref, layers, tag) {
    if (!this.plugin || !ref) return null;

    ref = typeof ref === "string" ? ref : ref.ref;

    const update = this.plugin.state.data.build();
    const existingNodes = this.plugin.state.data.selectQ((q) =>
      q.byRef(ref).subtree().withTag(tag),
    );
    if (existingNodes.length > 0) {
      update.to(existingNodes[0].transform.ref).update({ layers });
    } else {
      update
        .to(ref)
        .apply(
          StateTransforms.Representation
            .OverpaintStructureRepresentation3DFromScript,
          { layers },
          { tags: [tag] },
        );
    }

    await update.commit();
  }

  async updateTransformMatrix(ref, matrix = null, tag) {
    if (!this.plugin || !ref) return null;

    ref = typeof ref === "string" ? ref : ref.ref;

    if (!matrix) {
      matrix = Mat4.identity();
    }

    const update = this.plugin.state.data.build();
    const existingNodes = this.plugin.state.data.selectQ((q) =>
      q.byRef(ref).subtree().withTag(tag),
    );
    if (existingNodes.length > 0) {
      update.to(existingNodes[0].transform.ref).update({
        transform: {
          name: "matrix",
          params: { data: matrix, transpose: false },
        },
      });
    } else {
      update.to(ref).apply(
        StateTransforms.Model.TransformStructureConformation,
        {
          transform: {
            name: "matrix",
            params: { data: matrix, transpose: false },
          },
        },
        {
          tags: [tag],
        },
      );
    }
    await update.commit();
  }

  async updateRepresentationStyle(ref, color, alpha) {
    if (!this.plugin || !ref) return null;

    ref = typeof ref === "string" ? ref : ref.ref;
    const update = this.plugin.state.data.build();
    update.to(ref).update({
      colorTheme: {
        name: "uniform",
        params: { value: color },
      },
      typeParams: {
        alpha: alpha,
      },
    });
    await update.commit();
  }

  async updateVisibilityInBulk(array) {
    if (!this.plugin || !Array.isArray(array) || array.length == 0) return null;

    const update = this.plugin.state.data.build()
    for (let obj of array) {
      if (!obj.ref || obj.value == undefined) continue
      
      const ref = typeof obj.ref === 'string' ? obj.ref : obj.ref.ref
      update.to(ref).updateState({isHidden: !obj.value})
    }
    await update.commit()
  }

  getUpdate() {
    if (!this.plugin) return null;
    else return this.plugin.state.data.build();
  }

  getNodes(ref = undefined, tag = undefined) {
    if (!this.plugin || !ref) return null;

    ref = typeof ref === "string" ? ref : ref.ref;
    if (ref && tag)
      return this.plugin.state.data.selectQ((q) =>
        q.byRef(ref).subtree().withTag(tag),
      );
    else if (ref) return this.plugin.state.data.selectQ((q) => q.byRef(ref));
    else if (tag) return this.plugin.state.data.selectQ((q) => q.withTag(tag));

    return [];
  }

  async resetTransparencyInBulk(tag) {
    if (!this.plugin) return null;
    const update = this.plugin.state.data.build();
    const existingNodes = this.plugin.state.data.selectQ((q) => q.withTag(tag));
    if (existingNodes.length == 0) {
      return;
    } else {
      for (let node of existingNodes) {
        update.to(node.transform.ref).update({
          layers: [
            {
              script: { language: 'mol-script', expression: MS.struct.generator.all() },
              value: 1,
            },
          ],
        });
      }
    }
    await update.commit();
  }

  async addDistance(lociA, lociB, options = {}) {
    if (!this.plugin || !lociA || !lociB) return null;
    return this.plugin.managers.structure.measurement.addDistance(
      lociA,
      lociB,
      options,
    );
  }

  async remove(ref) {
    if (!this.plugin || !ref) return;
    const targetRef = typeof ref === "string" ? ref : ref.ref;
    if (!targetRef) return;
    const update = this.plugin.state.data.build().delete(targetRef);
    if (update.editInfo.count === 0) return;
    await update.commit();
  }

  onClick(handler) {
    if (!this.plugin?.behaviors?.interaction?.click) return () => {};
    const sub = this.plugin.behaviors.interaction.click.subscribe(handler);
    return () => sub.unsubscribe();
  }

  setBackground(color) {
    if (!this.plugin?.canvas3d) return;
    const renderer = this.plugin.canvas3d.props.renderer;
    this.plugin.canvas3d.setProps({
      renderer: {
        ...renderer,
        backgroundColor: parseHexColor(color),
      },
    });
  }

  setSpin(enabled) {
    if (!this.plugin?.canvas3d) return;
    const trackball = this.plugin.canvas3d.props.trackball;
    this.plugin.canvas3d.setProps({
      trackball: {
        ...trackball,
        animate: enabled
          ? { name: "spin", params: { speed: this.spinSpeed, axis: [0, 1, 0] } }
          : { name: "off", params: {} },
      },
    });
  }

  focusLoci(loci, durationMs = 0, extraRadius = 0, minRadius = 5) {
    if (!this.plugin) return;
    if (loci) {
      this.plugin.managers.camera.focusLoci(loci, { minRadius, extraRadius, durationMs });
    } else {
      this.plugin.managers.camera.reset();
    }
  }

  handleResize() {
    this.plugin?.canvas3d?.handleResize();
  }

  toggleFullscreen(element) {
    const target = element || this.container;
    if (!target) return;
    if (!document.fullscreenElement && target.requestFullscreen) {
      target.requestFullscreen();
    } else if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen();
    }
  }

  async makeImage() {
    if (!this.canvas) return null;
    return new Promise((resolve) => {
      this.canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  }

  dispose() {
    if (this.plugin) {
      this.plugin.dispose();
      this.plugin = null;
    }
    this.clickFocus()
    if (this.canvas && this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
    this.canvas = null;
  }
}
