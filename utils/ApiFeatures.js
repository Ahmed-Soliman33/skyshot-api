// eslint-disable-next-line import/no-extraneous-dependencies
const qs = require("qs");

class ApiFeatures {
  constructor(mongooseQuery, queryString) {
    this.mongooseQuery = mongooseQuery;
    this.queryString = queryString;
  }

  filter() {
    // Parse query string with qs Package
    // qs: This allows us to handle nested objects in the query string
    const queryStringObj = qs.parse(this.queryString, { depth: 1 });
    const excludeFields = ["page", "sort", "limit", "fields", "keyword"];
    excludeFields.forEach((field) => delete queryStringObj[field]);

    let queryStr = JSON.stringify(queryStringObj);
    queryStr = queryStr.replace(
      /\b(gt|gte|lt|lte|in)\b/g,
      (match) => `$${match}`
    );

    queryStr = JSON.parse(queryStr);
    this.mongooseQuery = this.mongooseQuery.find(queryStr);

    return this;
  }

  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(",").join(" ");
      // Use collation for case-insensitive, alphabetic sorting
      this.mongooseQuery = this.mongooseQuery
        .collation({ locale: "en", strength: 2 })
        .sort(sortBy);
    } else {
      this.mongooseQuery = this.mongooseQuery
        .collation({ locale: "en", strength: 2 })
        .sort("-createdAt");
    }

    return this;
  }

  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(",").join(" ");
      this.mongooseQuery.select(fields);
    } else {
      this.mongooseQuery.select("-__v"); // Exclude __v field by default
    }

    return this;
  }

  search(modelName) {
    if (this.queryString.keyword) {
      const searchQuery = this.queryString.keyword;

      let query = {};
      if (modelName === "Product") {
        query = {
          $or: [
            { title: { $regex: searchQuery, $options: "i" } },
            { description: { $regex: searchQuery, $options: "i" } },
          ],
        };
      } else {
        query = {
          $or: [{ name: { $regex: searchQuery, $options: "i" } }],
        };
      }
      this.mongooseQuery.find(query);
    }
    return this;
  }

  paginate(countDocuments) {
    const page = Number(this.queryString.page) || 1;
    const limit = Number(this.queryString.limit) || 25;
    const skip = (page - 1) * limit;
    const endIndex = page * limit;

    const paginationResults = {
      currentPage: page,
      limit,
    };

    paginationResults.numberOfPages = Math.ceil(countDocuments / limit);

    if (endIndex < countDocuments) {
      paginationResults.nextPage = page + 1;
    }

    if (skip > 0) {
      paginationResults.previousPage = page - 1;
    }

    this.paginationResults = paginationResults;
    this.mongooseQuery = this.mongooseQuery.skip(skip).limit(limit);
    return this;
  }
}

module.exports = ApiFeatures;
