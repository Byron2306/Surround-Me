(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SurroundWorldArtRegistry = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  class WorldArtRegistry {
    constructor(manifest, options = {}) {
      if (!manifest || !Array.isArray(manifest.assets)) throw new TypeError('manifest.assets must be an array');
      this.manifest = manifest;
      this._records = new Map();
      this._images = new Map();
      this.baseUrl = options.baseUrl || '';
      for (const record of manifest.assets) {
        if (!record || typeof record.id !== 'string' || !record.id) throw new TypeError('every asset requires a non-empty id');
        if (this._records.has(record.id)) throw new Error(`duplicate world-art asset id: ${record.id}`);
        this._records.set(record.id, record);
      }
    }

    get(id) {
      return this._records.get(id) || null;
    }

    require(id) {
      const record = this.get(id);
      if (!record) throw new Error(`world-art asset not found: ${id}`);
      if (record.status !== 'approved') throw new Error(`world-art asset ${id} is not approved (status=${record.status})`);
      return record;
    }

    phaseAAssets() {
      return Array.from(this._records.values())
        .filter((record) => record.phaseA === true && record.status === 'approved')
        .sort((a, b) => a.id.localeCompare(b.id));
    }

    attachImage(id, image) {
      if (!this.get(id)) throw new Error(`cannot attach image for unknown world-art asset: ${id}`);
      this._images.set(id, image);
      return image;
    }

    imageFor(id) {
      return this._images.get(id) || null;
    }

    runtimeUrl(id) {
      const record = this.get(id);
      if (!record) throw new Error(`world-art asset not found: ${id}`);
      return `${this.baseUrl}${record.runtimeSource}`;
    }
  }

  return { WorldArtRegistry };
});
