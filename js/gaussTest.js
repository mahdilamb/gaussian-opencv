let openCVTest = (function () {
    const imgElement = document.getElementById("imageSrc");
    const originalCanvas = document.createElement('canvas');
    originalCanvas.width = imgElement.width;
    originalCanvas.height = imgElement.height;
    originalCanvas.getContext('2d').drawImage(imgElement, 0, 0, imgElement.width, imgElement.height);
    const sigmaControl = document.getElementById("gaussianSigma");
    const kernelControl = document.getElementById("gaussianKernel");
    const canvas = document.getElementById("overlay");
    const ctx = canvas.getContext('2d');
    let isDragging = false;
    let isDown = false;
    const mouseStart = [0, 0];
    const mouseEnd = [0, 0];
    const lineSampleResolution = 5;
    let graphd3;
    canvas.addEventListener("mousedown", (e) => {
        isDown = true;
        mouseStart[0] = e.offsetX;
        mouseStart[1] = e.offsetY;
    });

    canvas.addEventListener("mousemove", (e) => {
        if (!isDown) {
            return;
        }
        graphd3.show();
        isDragging = true;
        mouseEnd[0] = e.offsetX;
        mouseEnd[1] = e.offsetY;
        ctx.strokeStyle = "#FFFF00";
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();
        ctx.moveTo(mouseStart[0], mouseStart[1]);
        ctx.lineTo(e.offsetX, e.offsetY);
        ctx.stroke();
        updateGraph();

    });
    document.getElementsByTagName("body")[0].addEventListener("mouseup", e => {
        if (e.target !== sigmaControl && e.target !== kernelControl && !isDragging) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (graphd3 !== undefined) {
                graphd3.hide();
            }

        } else {
            graphd3.show();
        }

        isDragging = false;
        isDown = false;
    });
    kernelControl.addEventListener("input", () => {
        updateImage();
    });
    sigmaControl.addEventListener("input", () => {
        updateImage();
    });

    function updateGraph() {

        const length = lineSampleResolution * Math.sqrt(((mouseEnd[0] - mouseStart[0]) * (mouseEnd[0] - mouseStart[0])) + ((mouseEnd[1] - mouseStart[1]) * (mouseEnd[1] - mouseStart[1])));
        const pixels = new Array(Math.round(length));

        const originalPixels = new Array(pixels.length);
        for (let i = 0; i < length; i++) {
            const x = mouseStart[0] + (mouseEnd[0] - mouseStart[0]) * i / length;
            const y = mouseStart[1] + (mouseEnd[1] - mouseStart[1]) * i / length;
            pixels[i] = sampleBilinear(document.getElementById("imageCanvas").getContext('2d'), x, y);
            originalPixels[i] = sampleBilinear(originalCanvas.getContext('2d'), x, y);
        }
        graphd3.update({"gray": originalPixels, "red": pixels});
    }

    function updateImage() {
        const sigma = parseFloat(sigmaControl.value) / 10;
        const size = parseInt(kernelControl.value) * 2 - 1;
        document.getElementById("current-gaussian").innerText = sigma;
        document.getElementById("current-kernel").innerText = size;

        //read source image
        const image = cv.imread(imgElement);
        //allocate output mat
        const processed = new cv.Mat();
        //set args for gaussian blur and run
        const kernelSize = new cv.Size(size, size);
        cv.GaussianBlur(image, processed, kernelSize, sigma);
        const restore_alpha = new cv.Mat();
        cv.cvtColor(processed, restore_alpha, cv.COLOR_RGBA2RGB);
        //copy result to canvas
        cv.imshow('imageCanvas', restore_alpha);
        if (canvas.style.display === 'none') {
            canvas.width = document.getElementById("imageCanvas").width;
            canvas.height = document.getElementById("imageCanvas").height;
            canvas.style.display = "";
        }

        //cleanup
        image.delete();
        processed.delete();
        restore_alpha.delete();
        if (graphd3 !== undefined) {
            updateGraph();
        }
    }

    function sampleBilinear(ctx, x, y) {
        if (canvas.width === 0) {
            return;
        }
        const p00 = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data[0];
        const p01 = ctx.getImageData(Math.floor(x), Math.ceil(y), 1, 1).data[0];
        const p11 = ctx.getImageData(Math.ceil(x), Math.ceil(y), 1, 1).data[0];
        const p10 = ctx.getImageData(Math.ceil(x), Math.floor(y), 1, 1).data[0];
        const tx = x % 1;
        const ty = y % 1;
        const a = p00 * (1 - tx) + p10 * tx;
        const b = p01 * (1 - tx) + p11 * tx;
        return a * (1 - ty) + b * ty;
    }

    function onOpenCvReady() {
        imgElement.style.display = "";
        updateImage();
    }

    let graph = (function () {
        const margin = {top: 10, right: 30, bottom: 30, left: 60},
            width = 640 - margin.left - margin.right,
            height = 400 - margin.top - margin.bottom;
        const svg = d3
            .select("#line-profile")
            .append("svg");
        const x = d3.scaleLinear();
        const y = d3.scaleLinear();

        function update(data) {
            svg.attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
                .append("g")
                .attr("transform",
                    "translate(" + margin.left + "," + margin.top + ")");
            d3.selectAll("svg > *").remove();
            const yRange = [Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER];
            x.domain([0, Object.values(data)[0].length / lineSampleResolution])
                .range([margin.left, width]);
            for (const key in data) {
                const range = d3.extent(data[key], function (d) {
                    return d;
                });

                yRange[0] = Math.min(range[0], yRange[0]);
                yRange[1] = Math.max(range[1], yRange[1]);
                let i = 0;
                svg.append('path')
                    .datum(data[key])
                    .attr("fill", "none")
                    .attr("stroke", key)
                    .attr("stroke-width", 1.5)
                    .attr("d", d3.line()
                        .x(function () {
                            return x(i++ / lineSampleResolution)
                        })
                        .y(function (d) {
                            return y(d)
                        })
                        .curve(d3.curveBasis)
                    );
            }

            y.domain(yRange)
                .range([height, 0]);

            svg.append("g")
                .attr("transform", "translate(0," + height + ")")
                .call(d3.axisBottom(x));
            svg.append("g")
                .call(d3.axisLeft(y))
                .attr("transform", "translate(" + margin.left + ",0)");
            svg.append("text")
                .attr("text-anchor", "end")
                .attr("x", margin.left + width * .5)
                .attr("y", height + margin.top + 25)
                .attr("font-size", 16)
                .text("Position from line start (px)");
            svg.append("text")
                .attr("text-anchor", "end")
                .attr("transform", "rotate(-90)")
                .attr("y", 20)
                .attr("x", -height * .5)
                .attr("font-size", 16)
                .text("Intensity (AU)");


        }

        function show() {
            document.getElementById("line-profile").style.display = "";
        }

        function hide() {
            document.getElementById("line-profile").style.display = "none";
        }

        return {
            update: update,
            hide: hide,
            show: show
        };
    });


    function onD3Ready() {
        graphd3 = graph();
    }

    return {
        onD3Ready: onD3Ready,
        onOpenCvReady: onOpenCvReady
    }
})();