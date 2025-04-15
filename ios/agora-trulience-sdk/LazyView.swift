//
//  LazyView.swift
//  agora-trulience-sdk
//
//  Created by Mateusz on 09/04/2025.
//

import SwiftUI

struct LazyView<Content: View>: View {
    let build: () -> Content

    init(_ build: @escaping @autoclosure () -> Content) {
        self.build = build
    }

    var body: Content {
        build()
    }
}
