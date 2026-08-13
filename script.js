(function () {
  const form = document.getElementById("regForm");
  const isMember = document.getElementById("isMember");
  const registrationType = document.getElementById("registrationType");
  const member2Section = document.getElementById("member2Section");
  const hasKidsUnder16 = document.getElementById("hasKidsUnder16");
  const kidsCountField = document.getElementById("kidsCountField");
  const priceDisplay = document.getElementById("priceDisplay");
  const priceBreakdown = document.getElementById("priceBreakdown");
  const formError = document.getElementById("formError");
  const submitBtn = document.getElementById("submitBtn");
  const submitBtnText = document.getElementById("submitBtnText");

  function currentValues() {
    return {
      isMember: isMember.value,
      registrationType: registrationType.value,
      kidsCount: kidsCountField.hidden ? 0 : (form.kidsCount.value || 0)
    };
  }

  function updateConditionalFields() {
    const isFamily = registrationType.value === "family";
    member2Section.hidden = !isFamily;
    form.member2_name.required = isFamily;
    form.member2_gender.required = isFamily;
    form.member2_email.required = isFamily;
    form.member2_phone.required = isFamily;

    const hasKids = hasKidsUnder16.value === "yes";
    kidsCountField.hidden = !hasKids;
    if (!hasKids) form.kidsCount.value = 0;
  }

  function updatePrice() {
    const values = currentValues();
    if (!values.isMember || !values.registrationType) {
      priceDisplay.textContent = "— kr";
      priceBreakdown.textContent = "أكمل بيانات نوع التسجيل عشان يظهر المبلغ";
      return;
    }
    const total = calculatePriceNOK(values);
    priceDisplay.textContent = total + " kr";
    const label = values.registrationType === "family" ? "تسجيل عائلي" : "تسجيل فردي";
    const memberLabel = values.isMember === "yes" ? "عضو 2026" : "غير عضو";
    priceBreakdown.textContent = `${label} · ${memberLabel}` + (values.kidsCount > 0 ? ` · ${values.kidsCount} طفل` : "");
  }

  [isMember, registrationType, hasKidsUnder16].forEach(el => {
    el.addEventListener("change", () => { updateConditionalFields(); updatePrice(); });
  });
  form.kidsCount.addEventListener("input", updatePrice);

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    formError.hidden = true;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    if (!form.agreeTerms.checked) {
      showError("لازم توافق على الشروط والأحكام قبل الاستمرار.");
      return;
    }

    const data = Object.fromEntries(new FormData(form).entries());
    data.agreeTerms = form.agreeTerms.checked;

    setLoading(true);
    try {
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "حصل خطأ أثناء تجهيز الدفع، حاول تاني.");
      }

      const { url } = await res.json();
      if (!url) throw new Error("لم يتم استلام رابط الدفع.");
      window.location.href = url; // redirect to Stripe Checkout
    } catch (err) {
      showError(err.message || "حصل خطأ غير متوقع، حاول تاني.");
      setLoading(false);
    }
  });

  function showError(msg) {
    formError.textContent = msg;
    formError.hidden = false;
    formError.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtnText.textContent = isLoading ? "جاري التجهيز..." : "المتابعة إلى الدفع";
  }

  updateConditionalFields();
  updatePrice();
})();
