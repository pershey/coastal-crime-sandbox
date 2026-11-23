// Low-poly geometry builder. Everything in the city (buildings, roads, cars, palms, boats)
// is made in code from boxes, tapered prisms and cylinders with a colour per face, merged
// into a handful of meshes so the whole city draws in a few hundred calls.
import * as THREE from '../../vendor/three.module.min.js';

const scratchColor = new THREE.Color();
const scratchPoint = new THREE.Vector3();
const scratchNormal = new THREE.Vector3();

export class MeshBuilder {
  constructor() {
    this.positions = [];
    this.normals = [];
    this.colors = [];
    this.uvs = [];
    this.indices = [];
    this.matrix = null;
    this.normalMatrix = new THREE.Matrix3();
  }

  get vertexCount() {
    return this.positions.length / 3;
  }

  /** Every shape added after this is placed by `matrix` (null to stop). */
  setTransform(matrix) {
    this.matrix = matrix;
    if (matrix) this.normalMatrix.getNormalMatrix(matrix);
    return this;
  }

  /** A four-cornered face, corners counter-clockwise seen from the front. uv is [u0, v0, u1, v1]. */
  quad(p0, p1, p2, p3, color, uv) {
    const ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2];
    const bx = p3[0] - p0[0], by = p3[1] - p0[1], bz = p3[2] - p0[2];
    scratchNormal.set(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx);
    if (this.matrix) scratchNormal.applyMatrix3(this.normalMatrix);
    scratchNormal.normalize();
    scratchColor.set(color);
    const base = this.vertexCount;
    const corners = [p0, p1, p2, p3];
    const u0 = uv ? uv[0] : 0, v0 = uv ? uv[1] : 0, u1 = uv ? uv[2] : 1, v1 = uv ? uv[3] : 1;
    const cornerUvs = [u0, v0, u1, v0, u1, v1, u0, v1];
    for (let i = 0; i < 4; i += 1) {
      scratchPoint.set(corners[i][0], corners[i][1], corners[i][2]);
      if (this.matrix) scratchPoint.applyMatrix4(this.matrix);
      this.positions.push(scratchPoint.x, scratchPoint.y, scratchPoint.z);
      this.normals.push(scratchNormal.x, scratchNormal.y, scratchNormal.z);
      this.colors.push(scratchColor.r, scratchColor.g, scratchColor.b);
      this.uvs.push(cornerUvs[i * 2], cornerUvs[i * 2 + 1]);
    }
    this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    return this;
  }

  /** A flat rectangle on the ground plane at height y, facing up. */
  ground(x0, z0, x1, z1, y, color, uv) {
    return this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], color, uv);
  }

  /**
   * A box whose top can be a different size and shifted, which covers plain boxes, sloped
   * car cabins, hip roofs and tapered towers. (cx, cz) is the centre, y0 the underside.
   * Options: topX, topZ (top size), shiftX, shiftZ (top offset), rotY, top (top colour),
   * noTop, bottom, noSides, uvMeters [metres per u, metres per v] for tiled facades.
   */
  prism(cx, y0, cz, sizeX, height, sizeZ, color, options = {}) {
    const bx = sizeX / 2, bz = sizeZ / 2;
    const tx = (options.topX ?? sizeX) / 2, tz = (options.topZ ?? sizeZ) / 2;
    const ox = options.shiftX ?? 0, oz = options.shiftZ ?? 0;
    const y1 = y0 + height;
    const cos = Math.cos(options.rotY ?? 0), sin = Math.sin(options.rotY ?? 0);
    const at = (lx, y, lz) => [cx + lx * cos + lz * sin, y, cz - lx * sin + lz * cos];
    // Corner names: b/t = bottom/top, then x sign, then z sign.
    const bpp = at(bx, y0, bz), bpn = at(bx, y0, -bz), bnp = at(-bx, y0, bz), bnn = at(-bx, y0, -bz);
    const tpp = at(ox + tx, y1, oz + tz), tpn = at(ox + tx, y1, oz - tz);
    const tnp = at(ox - tx, y1, oz + tz), tnn = at(ox - tx, y1, oz - tz);
    if (!options.noSides) {
      const m = options.uvMeters;
      const uvX = m ? [0, y0 / m[1], sizeZ / m[0], y1 / m[1]] : undefined;
      const uvZ = m ? [0, y0 / m[1], sizeX / m[0], y1 / m[1]] : undefined;
      this.quad(bpp, bpn, tpn, tpp, color, uvX);
      this.quad(bnn, bnp, tnp, tnn, color, uvX);
      this.quad(bnp, bpp, tpp, tnp, color, uvZ);
      this.quad(bpn, bnn, tnn, tpn, color, uvZ);
    }
    if (!options.noTop && tx > 0.001 && tz > 0.001) this.quad(tnp, tpp, tpn, tnn, options.top ?? color);
    if (options.bottom) this.quad(bnn, bpn, bpp, bnp, color);
    return this;
  }

  box(cx, y0, cz, sizeX, height, sizeZ, color, options) {
    return this.prism(cx, y0, cz, sizeX, height, sizeZ, color, options);
  }

  /** An upright cylinder or cone with flat-shaded sides. radiusTop 0 makes a cone. */
  cylinder(cx, y0, cz, radiusBottom, radiusTop, height, segments, color, options = {}) {
    const y1 = y0 + height;
    const tx = cx + (options.shiftX ?? 0), tz = cz + (options.shiftZ ?? 0);
    for (let i = 0; i < segments; i += 1) {
      const a0 = (i / segments) * Math.PI * 2, a1 = ((i + 1) / segments) * Math.PI * 2;
      const s0 = Math.sin(a0), c0 = Math.cos(a0), s1 = Math.sin(a1), c1 = Math.cos(a1);
      const b0 = [cx + s0 * radiusBottom, y0, cz + c0 * radiusBottom];
      const b1 = [cx + s1 * radiusBottom, y0, cz + c1 * radiusBottom];
      const t0 = [tx + s0 * radiusTop, y1, tz + c0 * radiusTop];
      const t1 = [tx + s1 * radiusTop, y1, tz + c1 * radiusTop];
      this.quad(b0, b1, t1, t0, color);
      // Caps are fans of triangles, written as quads whose last two corners coincide.
      if (!options.noTop && radiusTop > 0.001) this.quad([tx, y1, tz], t0, t1, t1, options.top ?? color);
      if (options.bottom) this.quad([cx, y0, cz], b1, b0, b0, color);
    }
    return this;
  }

  build() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geometry.setIndex(this.vertexCount > 65535 ? new THREE.Uint32BufferAttribute(this.indices, 1) : this.indices);
    geometry.computeBoundingSphere();
    return geometry;
  }

  /** Build a mesh that casts and receives shadows; null when nothing was added. */
  toMesh(material, options = {}) {
    if (this.vertexCount === 0) return null;
    const mesh = new THREE.Mesh(this.build(), material);
    mesh.castShadow = options.castShadow ?? true;
    mesh.receiveShadow = options.receiveShadow ?? true;
    return mesh;
  }
}
