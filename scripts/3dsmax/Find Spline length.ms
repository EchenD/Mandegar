(
    if selection.count == 1 then
    (
        src = selection[1]
        tmp = copy src

        result = convertToSplineShape tmp

        if result != undefined then
        (
            totalLength = 0.0

            for i = 1 to (numSplines tmp) do
            (
                lengths = getSegLengths tmp i

                if lengths != undefined then
                (
                    splineLength = lengths[lengths.count]
                    totalLength += splineLength

                    format "Spline % Length: %\n" i splineLength
                )
            )

            format "\nTOTAL LENGTH: %\n" totalLength
            delete tmp
        )
        else
        (
            delete tmp
            messageBox "Selected object cannot be converted to a spline."
        )
    )
    else
    (
        messageBox "Select exactly one spline."
    )
)