export default {
  render(container) {
    container.innerHTML = `
      <section class="tool-section">
        <h3>Payment receiving needs setup</h3>
        <p>Toolbox does not yet have a connected merchant service for receiving your payments. Use your payment provider’s hosted checkout or verified bank details.</p>
        <p>Previous locally generated account numbers and payment statuses were demonstrations. They are not valid receiving accounts or proof of payment.</p>
        <a class="btn btn-secondary" href="#invoice-generator">Create an invoice</a>
      </section>`;
  },
  destroy() {},
};
