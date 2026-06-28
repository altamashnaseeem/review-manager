// Simple request body validator
const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    const messages = error.details.map(d => d.message).join(', ');
    return res.status(400).json({ success: false, message: messages });
  }
  next();
};

export default validate;
