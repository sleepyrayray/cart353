function setup() {
  const canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("space");
  describe("An empty space where a planetary system will develop.");
}

function draw() {
  background("#0b0d16");
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
