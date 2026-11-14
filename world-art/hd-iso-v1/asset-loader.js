(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SurroundWorldArtLoader = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  async function loadSceneAssets(registry, ids, loadImage, options = {}) {
    return Promise.all([...new Set(ids)].map(async id => {
      try {
        const record = registry.get(id);
        if (!record) throw new Error(`unknown asset: ${id}`);
        if (options.candidates !== true) registry.require(id);
        else if (!['candidate', 'approved'].includes(record.status)) throw new Error(`status=${record.status}`);
        const image = await loadImage(registry.runtimeUrl(id));
        registry.attachImage(id, image);
        return {id, state: record.status === 'approved' ? 'APPROVED' : 'CANDIDATE'};
      } catch (error) {
        return {id, state:'REFUSE', reason:error.message};
      }
    }));
  }
  return {loadSceneAssets};
});
