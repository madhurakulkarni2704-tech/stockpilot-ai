// Parses req[source] with a zod schema; parsed (coerced/defaulted) data replaces the original.
const validate = (schema, source = "body") => (req, res, next) => {
  req[source] = schema.parse(req[source]);
  next();
};
module.exports = validate;
