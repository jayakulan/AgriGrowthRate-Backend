// Dynamoose Database Query Helper Utility Functions

/**
 * Find a single item by primary key (id)
 */
const findById = async (Model, id) => {
  if (!id) return null;
  try {
    const res = await Model.get(id);
    return res || null;
  } catch (err) {
    return null;
  }
};

/**
 * Find a single item using a GSI index or scanned filter
 */
const findOne = async (Model, key, value) => {
  if (!value) return null;
  try {
    const results = await Model.query(key).eq(value).exec();
    if (results && results.length > 0) return results[0];
  } catch (err) {
    // Fallback to scan if query on non-indexed field
  }
  try {
    const results = await Model.scan(key).eq(value).exec();
    return results && results.length > 0 ? results[0] : null;
  } catch (err) {
    return null;
  }
};

/**
 * Find multiple items matching filter criteria
 */
const find = async (Model, filters = {}) => {
  try {
    const keys = Object.keys(filters);
    if (keys.length === 0) {
      return await Model.scan().exec();
    }
    const scan = Model.scan();
    keys.forEach((key) => {
      if (filters[key] !== undefined && filters[key] !== null) {
        scan.filter(key).eq(filters[key]);
      }
    });
    return await scan.exec();
  } catch (err) {
    return [];
  }
};

/**
 * Delete items matching filter
 */
const deleteMany = async (Model, filters = {}) => {
  try {
    const items = await find(Model, filters);
    for (const item of items) {
      await Model.delete(item.id);
    }
    return { deletedCount: items.length };
  } catch (err) {
    return { deletedCount: 0 };
  }
};

module.exports = {
  findById,
  findOne,
  find,
  deleteMany
};
