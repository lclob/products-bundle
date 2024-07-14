class ProductBundler extends HTMLElement {
  constructor() {
    super();

    if (this.querySelector("css-slider")) {
      this.querySelector("css-slider").addEventListener("ready", () => {
        this.init();
      });
    } else {
      this.init();
    }
  }

  init() {
    this.bundleProducts = [
      ...this.querySelectorAll("[data-js-bundler-product]"),
    ];
    this._bundleTemplate = this.querySelector(
      "[data-js-bundler-product]",
    ).cloneNode(true);
    this._bundleMin = parseInt(this.dataset.minimum);

    this.addEventListener("click", this.onClick.bind(this));

    this.querySelector("[data-js-bundler-toggle]").addEventListener(
      "click",
      (e) => {
        if (window.innerWidth < 768) {
          this.classList.toggle("opened");
        }
      },
    );
  }

  onClick(event) {
    const target = event.target;

    if (target.closest("[data-js-product-add-to-cart]")) {
      this.addToCart(target);
    } else if (target.closest("[data-js-bundler-product-remove]")) {
      this.clearSlot(target.closest("[data-js-bundler-product]"));
    } else if (target.closest("[data-js-add-bundle-to-cart]")) {
      this.addBundleToCart();
    }
  }

  addToCart(target) {
    event.preventDefault();
    const product = target.closest("[data-js-product-item]");
    const id = product
      .querySelector(".product-form")
      .querySelector('input[name="id"]').value;
    const data_variants = JSON.parse(
      product.querySelector('.product-variants script[type="application/json"]')
        .textContent,
    );
    const variant = data_variants.find((variant) => {
      return variant["id"] == id;
    });
    this.addToBundle(variant, product);
    this.classList.add("opened");
  }

  addBundleToCart() {
    if (!this.findEmptySlot()) {
      let items = [];
      this.bundleProducts.map((elm) => {
        if (elm.dataset.id) {
          if (
            !items.find((item) => {
              if (item.id == elm.dataset.id) {
                item.quantity++;
                return true;
              }
            })
          ) {
            items.push({
              id: elm.dataset.id,
              quantity: 1,
            });
          }
        }
      });

      if (items.length > 0) {
        const submitButton = this.querySelector("[data-js-add-bundle-to-cart]");

        let sectionsToBundle = ["variant-added"];
        document.documentElement.dispatchEvent(
          new CustomEvent("cart:prepare-bundled-sections", {
            bubbles: true,
            detail: { sections: sectionsToBundle },
          }),
        );

        let formData = {};
        formData.items = [];

        items.forEach((item) => {
          let newItem = {};
          newItem.id = item.id;
          newItem.quantity = item.quantity;
          newItem.sections_url = `${Shopify.routes.root}variants/${item.id}`;
          formData.items.push(newItem);
        });

        formData.sections = sectionsToBundle.join(",");
        let requestBody = JSON.stringify(formData);

        fetch(window.Shopify.routes.root + "cart/add.js", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: requestBody,
        })
          .then((response) => {
            return response.json();
          })
          .then((data) => {
            console.log("Success:", data);

            this.querySelectorAll("[data-js-bundler-product]").forEach(
              (elm) => {
                this.clearSlot(elm);
              },
            );

            this.classList.remove("opened");
            this.handleMiniCartPopup(items, data);

            this._onSubmit(data);
          })
          .catch((error) => {
            console.error("Error:", error);
          });
      }
    }
  }

  async _onSubmit(data, viewDrawer) {
    const responseJson = await (
      await fetch(`${Shopify.routes.root}cart.js`)
    ).json();
    const cartContent = responseJson;
    cartContent["sections"] = data["sections"];

    if (viewDrawer) {
      this.dispatchEvent(
        new CustomEvent("variant:add", {
          bubbles: true,
          detail: {
            items: data.hasOwnProperty("items") ? data["items"] : [data],
            cart: cartContent,
          },
        }),
      );
    }

    this.dispatchEvent(
      new CustomEvent("cart:change", {
        bubbles: true,
        detail: {
          baseEvent: "variant:add",
          cart: cartContent,
        },
      }),
    );

    document.dispatchEvent(new CustomEvent("cart:refresh"));
  }

  getVariantData() {
    this.variantData =
      this.variantData ||
      JSON.parse(this.querySelector('[type="application/json"]').textContent);
    return this.variantData;
  }

  findEmptySlot() {
    return this.bundleProducts.find((elm) => {
      return elm.classList.contains("bundler-product--empty");
    });
  }

  clearSlot(slot) {
    if (this.bundleProducts.length > this._bundleMin) {
      this.bundleProducts.splice(this.bundleProducts.indexOf(slot), 1);
      slot.remove();
    } else {
      slot.product.classList.remove("product-item--bundled");
      slot.dataset.id = "";
      slot.product = null;
      slot.classList.add("bundler-product--empty");
      slot.querySelector("[data-js-bundler-product-text]").innerHTML = "";
      slot.querySelector("[data-js-bundler-product-image]").innerHTML = "";
    }
    if (this.findEmptySlot()) {
      this.classList.remove("bundler-full");
    }
    this.reorderSlots();
  }

  reorderSlots() {
    let ei = 0,
      fi = -100;
    this.querySelectorAll("[data-js-bundler-product]").forEach((elm, i) => {
      if (elm.classList.contains("bundler-product--empty")) {
        elm.style.order = ei++;
      } else {
        elm.style.order = fi++;
      }
    });
  }

  createSlot() {
    const newSlot = this._bundleTemplate.cloneNode(true);
    newSlot
      .querySelector("[data-js-bundler-product-remove]")
      .addEventListener("click", (e) => {
        this.clearSlot(e.target.closest("[data-js-bundler-product]"));
      });
    this.querySelector("[data-js-bundler-products]").appendChild(newSlot);
    this.bundleProducts.push(newSlot);
  }

  addToBundle(variant, product) {
    let slot = this.findEmptySlot();
    const imageSrc = variant.featured_image
      ? variant.featured_image.src
      : product.querySelector("[data-js-quick-buy-product-image]").textContent;

    if (!slot && this.hasAttribute("data-limit-maximum")) {
      this.createSlot();
      slot = this.findEmptySlot();
    }

    if (slot) {
      slot.classList.remove("bundler-product--empty");
      slot.querySelector("[data-js-bundler-product-text]").innerHTML = `
              <span class="bundler-product__text-title text-line-height--medium text-weight--bold">${
                product.querySelector("[data-js-quick-buy-product-title]")
                  .textContent
              }</span>
              ${
                product
                  .querySelector(".product-variants")
                  .hasAttribute("data-has-variants")
                  ? `<span class="bundler-product__text-variant text-color--opacity">${variant.title}</span>`
                  : ""
              }
            `;
      slot.querySelector("[data-js-bundler-product-image]").innerHTML = `
              <img src="${this.getResizedImageSrc(imageSrc, 60)}"
                srcset="
                  ${this.getResizedImageSrc(imageSrc, 60)} 60w,
                  ${this.getResizedImageSrc(imageSrc, 120)} 120w,
                  ${this.getResizedImageSrc(imageSrc, 180)} 180w
                "
                sizes="60px"
              />
            `;

      if (this.hasAttribute("data-limit-bundles")) {
        product.classList.add("product-item--bundled");
      }

      slot.product = product;
      slot.dataset.id = product.querySelector('input[name="id"]').value;
    } else {
      // when bundle is full, show message
    }

    if (!this.findEmptySlot()) {
      this.classList.add("bundler-full");
    }
  }

  getResizedImageSrc(src, size, crop = "center") {
    return `${src}${
      src.includes("?") ? "&" : "?"
    }width=${size}&height=${size}&crop=${crop}`.replace(/\n|\r|\s/g, "");
  }

  show(element) {
    element.setAttribute("style", "");
    setTimeout(() => {
      element.classList.add("active");
    }, 10);
    setTimeout(() => {
      if (element.querySelector("[data-js-first-focus]")) {
        element.querySelector("[data-js-first-focus]").focus();
      }
    }, 250);
  }

  hide(element) {
    element.classList.remove("active");
    setTimeout(() => {
      element.style.display = "none";
    }, 500);
  }

  handleMiniCartPopup(items, data) {
    const miniCartPopup = document.getElementById("mini-cart-popup");
    const viewDrawer = miniCartPopup.querySelector(".view-drawer");

    if (items.length == 1) {
      miniCartPopup.querySelector("[data-js-mini-cart-single]").style.display =
        "block";
      miniCartPopup.querySelector("[data-js-mini-cart-plural]").style.display =
        "none";
    } else {
      miniCartPopup.querySelector("[data-js-mini-cart-plural]").style.display =
        "block";
      miniCartPopup.querySelector("[data-js-mini-cart-plural]").innerHTML =
        miniCartPopup
          .querySelector("[data-js-mini-cart-plural]")
          .innerHTML.replace("count", items.length);
      miniCartPopup.querySelector("[data-js-mini-cart-single]").style.display =
        "none";
    }

    this.show(miniCartPopup);

    viewDrawer.addEventListener("click", (event) => {
      event.preventDefault();
      this._onSubmit(data, viewDrawer);
      this.hide(miniCartPopup);
    });

    if (miniCartPopup.dataset.hide != "0") {
      setTimeout(() => {
        this.hide(miniCartPopup);
      }, parseInt(miniCartPopup.dataset.hide));
    }
  }
}

if (typeof customElements.get("product-bundler") == "undefined") {
  customElements.define("product-bundler", ProductBundler);
}
